// End-to-end REFUND flow test.
// Client creates a contract, deposits, then cancels and reclaims the full
// escrow (Refund redeemer, no milestones paid). Drives the REAL app code
// (src/utils/transactions.js) and the REAL backend API.
//
// Run from client/: npx vite-node scripts/e2e-refund.mjs

import fs from "node:fs";
import { MeshWallet, BlockfrostProvider } from "@meshsdk/core";
import {
  buildDepositTransaction,
  buildRefundTransaction,
  findEscrowUtxo,
} from "../src/utils/transactions.js";

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
const WALLETS_FILE =
  process.env.E2E_WALLETS_FILE || "/vercel/share/blockpay-test-wallets.json";
const BLOCKFROST_KEY = process.env.VITE_BLOCKFROST_KEY;

if (!BLOCKFROST_KEY) {
  console.error("FATAL: VITE_BLOCKFROST_KEY not set");
  process.exit(1);
}

const log = (...a) => console.log("[e2e-refund]", ...a);
const provider = new BlockfrostProvider(BLOCKFROST_KEY);
const seeds = JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));

const mkWallet = async (words) => {
  const w = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words },
  });
  await w.init();
  return w;
};

async function apiCall(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForTx(txHash, label, maxMin = 6) {
  log(`waiting for ${label} tx ${txHash.slice(0, 16)}... to confirm`);
  const deadline = Date.now() + maxMin * 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("https://preprod.koios.rest/api/v1/tx_status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ _tx_hashes: [txHash] }),
      });
      const d = await res.json();
      if (d?.[0]?.num_confirmations >= 1) {
        log(`${label} CONFIRMED (${d[0].num_confirmations} confirmations)`);
        return true;
      }
    } catch {
      /* transient */
    }
    await sleep(15_000);
  }
  throw new Error(`${label} tx not confirmed within ${maxMin} minutes`);
}

const lovelaceBalance = async (addr) => {
  const utxos = await provider.fetchAddressUTxOs(addr);
  return utxos
    .flatMap((u) => u.output.amount)
    .filter((a) => a.unit === "lovelace")
    .reduce((s, a) => s + Number(a.quantity), 0);
};

async function main() {
  const clientWallet = await mkWallet(seeds.client.mnemonic);
  const freelancerWallet = await mkWallet(seeds.freelancer.mnemonic);
  const clientAddr = seeds.client.address;

  // ---------- 0. Top up client from freelancer if needed ----------
  const clientBal = await lovelaceBalance(clientAddr);
  log(`client balance: ${clientBal / 1e6} ADA`);
  if (clientBal < 7_000_000) {
    log("STEP 0: topping up client wallet with 6 ADA from freelancer");
    const { Transaction } = await import("@meshsdk/core");
    const tx = new Transaction({ initiator: freelancerWallet });
    tx.sendLovelace(clientAddr, "6000000");
    const unsigned = await tx.build();
    const signed = await freelancerWallet.signTx(unsigned);
    const topupTx = await freelancerWallet.submitTx(signed);
    await waitForTx(topupTx, "TOPUP");
  }

  // ---------- 1. Login ----------
  const login = async (role) => {
    const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
    const r = await apiCall("/auth/login", {
      method: "POST",
      body: { email, password: "E2eTest123!secure" },
    });
    if (r.status !== 200) {
      console.error(`login failed for ${role}`, r);
      process.exit(1);
    }
    return r.json;
  };
  const clientAuth = await login("client");
  const freelancerAuth = await login("freelancer");
  const clientToken = clientAuth.token;
  const freelancerId = freelancerAuth.user.id;
  log("users ready");

  // ---------- 2. Create contract (1 milestone x 4 ADA) ----------
  log("STEP 2: creating contract (1 milestone x 4 ADA)");
  const created = await apiCall("/contracts", {
    method: "POST",
    token: clientToken,
    body: {
      jobId: "507f1f77bcf86cd799439011",
      freelancerId,
      totalAmount: 4_000_000,
      milestones: [
        { id: "ms-refund-001", title: "Never delivered", amount: 4_000_000 },
      ],
    },
  });
  if (created.status !== 201) {
    console.error("createContract failed", created);
    process.exit(1);
  }
  const { contractId, contractAddress, datum: contractDatum } = {
    contractId: created.json.contractId,
    contractAddress: created.json.contractAddress,
    datum: created.json.contractDatum,
  };
  log("contract created:", contractId, "at", contractAddress);

  const isBech32 = (s) =>
    typeof s === "string" && /^(addr1|addr_test1)[0-9a-z]+$/.test(s);
  const datum = {
    client: contractDatum.client,
    freelancer: contractDatum.freelancer,
    total_amount: contractDatum.totalAmount,
    milestones: contractDatum.milestones,
    contract_nonce: contractDatum.contractNonce,
    fee_percent: contractDatum.feePercent,
    fee_address: isBech32(contractDatum.feeAddress)
      ? contractDatum.feeAddress
      : contractDatum.client,
    expiration: null,
    arbitrator: contractDatum.client,
  };

  // ---------- 3. Deposit ----------
  log("STEP 3: depositing 4 ADA into escrow");
  const depositTxHash = await buildDepositTransaction(
    clientWallet,
    contractAddress,
    contractDatum.totalAmount,
    datum,
  );
  log("deposit submitted:", depositTxHash);
  await apiCall(`/contracts/${contractId}/deposit`, {
    method: "POST",
    token: clientToken,
    body: { txHash: depositTxHash, amount: contractDatum.totalAmount },
  });
  await waitForTx(depositTxHash, "DEPOSIT");

  // Confirm via the verification endpoint (flips to FUNDED)
  let funded = false;
  for (let i = 0; i < 12; i++) {
    const s = await apiCall(`/contracts/${contractId}/deposit/status`, {
      token: clientToken,
    });
    log(`deposit/status -> ${s.json.offchainState}`);
    if (s.json.offchainState === "FUNDED") {
      funded = true;
      break;
    }
    await sleep(10_000);
  }
  if (!funded) throw new Error("deposit never verified as FUNDED");

  const balBeforeRefund = await lovelaceBalance(clientAddr);
  log(`client balance before refund: ${balBeforeRefund / 1e6} ADA`);

  // ---------- 4. Refund (no milestones paid - no expiration needed) ----------
  log("STEP 4: building + submitting REFUND (full 4 ADA back to client)");
  const onChainUtxos = await provider.fetchAddressUTxOs(contractAddress);
  const rawUtxo = findEscrowUtxo(onChainUtxos, {
    clientAddress: clientAddr,
    depositTxHashes: [depositTxHash],
  });
  if (!rawUtxo) throw new Error("findEscrowUtxo returned no match!");
  const formattedUtxo = {
    input: {
      txHash: rawUtxo.txHash || rawUtxo.input?.txHash,
      outputIndex: rawUtxo.outputIndex ?? rawUtxo.input?.outputIndex,
    },
    output: {
      address: contractAddress,
      amount: rawUtxo.amount || rawUtxo.output?.amount,
    },
  };

  const refundTxHash = await buildRefundTransaction(
    clientWallet,
    contractAddress,
    datum,
    4_000_000,
    clientAddr,
    formattedUtxo,
    { afterExpiration: false },
  );
  log("REFUND submitted:", refundTxHash);
  await waitForTx(refundTxHash, "REFUND");

  // ---------- 5. Record with backend ----------
  const recorded = await apiCall(`/contracts/${contractId}/refund`, {
    method: "POST",
    token: clientToken,
    body: { txHash: refundTxHash },
  });
  log(
    "refundContract ->",
    recorded.status,
    JSON.stringify(recorded.json).slice(0, 250),
  );
  if (recorded.status !== 200) {
    throw new Error(`refund recording failed with ${recorded.status}`);
  }
  if (recorded.json.offchainState !== "CANCELLED") {
    throw new Error(
      `expected CANCELLED, got ${recorded.json.offchainState}`,
    );
  }

  const balAfterRefund = await lovelaceBalance(clientAddr);
  log(`client balance after refund: ${balAfterRefund / 1e6} ADA`);
  log(
    `net recovered: ${(balAfterRefund - balBeforeRefund) / 1e6} ADA (4 minus tx fee)`,
  );

  log("=== E2E REFUND FLOW COMPLETE ===");
  log(`deposit tx: https://preprod.cardanoscan.io/transaction/${depositTxHash}`);
  log(`refund tx:  https://preprod.cardanoscan.io/transaction/${refundTxHash}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[e2e-refund] FAILED:", e?.message || e);
  if (e?.stack) console.error(e.stack.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
});
