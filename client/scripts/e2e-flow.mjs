// End-to-end escrow flow test.
// Drives the REAL app code (src/utils/transactions.js) and the REAL backend
// API, using programmatic Mesh wallets instead of a browser extension.
//
// Run from client/: npx vite-node scripts/e2e-flow.mjs
// Requires env: VITE_BLOCKFROST_KEY, and a funded client test wallet whose
// mnemonic is stored at /vercel/share/blockpay-test-wallets.json (never committed).

import fs from "node:fs";
import { MeshWallet, BlockfrostProvider } from "@meshsdk/core";
import {
  buildDepositTransaction,
  buildReleaseTransaction,
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

const log = (...a) => console.log("[e2e]", ...a);
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
      const res = await fetch(
        "https://preprod.koios.rest/api/v1/tx_status",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ _tx_hashes: [txHash] }),
        },
      );
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

async function main() {
  const ts = Date.now();
  const isBech32 = (s) =>
    typeof s === "string" && /^(addr1|addr_test1)[0-9a-z]+$/.test(s);

  // ---------- 1. Register users ----------
  log("STEP 1: registering e2e users via backend API");
  const reg = async (role, address) =>
    apiCall("/auth/register", {
      method: "POST",
      body: {
        email: `e2e-${role}-${ts}@blockpay-test.dev`,
        password: "E2eTest123!secure",
        displayName: `E2E ${role} ${ts}`,
        role,
        walletAddress: address,
      },
    });

  // Register, or log back in if this test wallet was registered by a
  // previous run (backend enforces one account per wallet address).
  const regOrLogin = async (role, address) => {
    const r = await reg(role, address);
    if (r.status === 201) return r;
    if (r.status === 409) {
      const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
      if (!email) {
        console.error(
          `wallet already registered; set E2E_${role.toUpperCase()}_EMAIL to reuse the account`,
        );
        process.exit(1);
      }
      const login = await apiCall("/auth/login", {
        method: "POST",
        body: { email, password: "E2eTest123!secure" },
      });
      if (login.status !== 200) {
        console.error("login failed", login);
        process.exit(1);
      }
      log(`reusing existing ${role} account ${email}`);
      return login;
    }
    console.error("register failed", r);
    process.exit(1);
  };

  const clientReg = await regOrLogin("client", seeds.client.address);
  const freelancerReg = await regOrLogin("freelancer", seeds.freelancer.address);
  const clientToken = clientReg.json.token;
  const freelancerId = freelancerReg.json.user.id;
  log("users ready:", clientReg.json.user.id, freelancerId);

  const clientWallet = await mkWallet(seeds.client.mnemonic);
  const clientAddr = seeds.client.address;

  let contractId;
  let contractAddress;
  let contractDatum;
  let depositTxHash;

  if (process.env.E2E_RESUME_CONTRACT_ID && process.env.E2E_RESUME_DEPOSIT_TX) {
    // ---------- Resume mode: reuse an existing funded contract ----------
    contractId = process.env.E2E_RESUME_CONTRACT_ID;
    depositTxHash = process.env.E2E_RESUME_DEPOSIT_TX;
    log("RESUME MODE: contract", contractId, "deposit", depositTxHash.slice(0, 16));
    const fetched = await apiCall(`/contracts/${contractId}`, {
      token: clientToken,
    });
    if (fetched.status !== 200) {
      console.error("fetch contract failed", fetched);
      process.exit(1);
    }
    const c = fetched.json.contract || fetched.json;
    contractAddress = c.contractAddress;
    contractDatum = c.datum;
    log("resumed contract at:", contractAddress);
  } else {
    // ---------- 2. Create contract ----------
    log("STEP 2: creating contract (2 milestones x 6 ADA)");
    const milestones = [
      { id: "ms-001", title: "First deliverable", amount: 6_000_000 },
      { id: "ms-002", title: "Final deliverable", amount: 6_000_000 },
    ];
    const created = await apiCall("/contracts", {
      method: "POST",
      token: clientToken,
      body: {
        jobId: "507f1f77bcf86cd799439011", // placeholder ObjectId (no job flow in this test)
        freelancerId,
        totalAmount: 12_000_000,
        milestones,
      },
    });
    if (created.status !== 201) {
      console.error("createContract failed", created);
      process.exit(1);
    }
    ({ contractId, contractAddress, contractDatum } = created.json);
    log("contract created:", contractId, "script address:", contractAddress);
  }

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

  if (!depositTxHash) {
    // ---------- 3. Deposit (mirrors ContractDetail.jsx proceedWithDeposit) ----------
    log("STEP 3: building + signing + submitting DEPOSIT (12 ADA)");
    depositTxHash = await buildDepositTransaction(
      clientWallet,
      contractAddress,
      contractDatum.totalAmount,
      datum,
    );
    log("deposit submitted:", depositTxHash);

    const recorded = await apiCall(`/contracts/${contractId}/deposit`, {
      method: "POST",
      token: clientToken,
      body: { txHash: depositTxHash, amount: contractDatum.totalAmount },
    });
    log("recordDeposit ->", recorded.status, JSON.stringify(recorded.json).slice(0, 200));

    await waitForTx(depositTxHash, "DEPOSIT");
  }

  // ---------- 4. Release milestone ms-001 (mirrors handleApproveMilestone) ----------
  log("STEP 4: building + signing + submitting RELEASE for ms-001");
  const milestoneId = "ms-001";
  const milestoneAmount = 6_000_000;

  const onChainUtxos = await provider.fetchAddressUTxOs(contractAddress);
  log(`script address has ${onChainUtxos.length} utxos`);

  const rawUtxo = findEscrowUtxo(onChainUtxos, {
    milestoneId,
    clientAddress: clientAddr,
    depositTxHashes: [depositTxHash],
  });
  if (!rawUtxo) throw new Error("findEscrowUtxo returned no match!");
  log(
    "selected escrow utxo:",
    (rawUtxo.input?.txHash || rawUtxo.txHash) + "#" +
      (rawUtxo.input?.outputIndex ?? rawUtxo.outputIndex),
  );
  const pickedTx = rawUtxo.input?.txHash || rawUtxo.txHash;
  if (pickedTx !== depositTxHash) {
    throw new Error(
      `findEscrowUtxo picked WRONG utxo (${pickedTx}), expected ${depositTxHash}`,
    );
  }

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

  const feePercent = contractDatum.feePercent || 100;
  const feeAmount = Math.floor((milestoneAmount * feePercent) / 10000);
  const payoutAmount = milestoneAmount - feeAmount;
  const remainingAmount = datum.total_amount - milestoneAmount;
  const newDatum = {
    ...datum,
    milestones: datum.milestones.map((m) =>
      m.id === milestoneId ? { ...m, paid: true } : m,
    ),
  };

  const releaseTxHash = await buildReleaseTransaction(
    clientWallet,
    contractAddress,
    milestoneId,
    datum,
    newDatum,
    payoutAmount,
    seeds.freelancer.address,
    remainingAmount,
    formattedUtxo,
    datum.fee_address,
    feeAmount,
  );
  log("RELEASE submitted:", releaseTxHash);

  await waitForTx(releaseTxHash, "RELEASE");

  // ---------- 5. Record approval with backend ----------
  const approved = await apiCall(
    `/contracts/${contractId}/milestones/${milestoneId}/approve`,
    { method: "POST", token: clientToken, body: { txHash: releaseTxHash } },
  );
  log("approveMilestone ->", approved.status, JSON.stringify(approved.json).slice(0, 300));

  // ---------- 6. Verify freelancer payout on-chain ----------
  const fUtxos = await provider.fetchAddressUTxOs(seeds.freelancer.address);
  const fBalance = fUtxos
    .flatMap((u) => u.output.amount)
    .filter((a) => a.unit === "lovelace")
    .reduce((s, a) => s + Number(a.quantity), 0);
  log(`freelancer on-chain balance: ${fBalance / 1e6} ADA (expected ~${payoutAmount / 1e6})`);

  log("=== E2E FLOW COMPLETE ===");
  log(`deposit tx:  https://preprod.cardanoscan.io/transaction/${depositTxHash}`);
  log(`release tx:  https://preprod.cardanoscan.io/transaction/${releaseTxHash}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[e2e] FAILED:", e?.message || e);
  if (e?.stack) console.error(e.stack.split("\n").slice(0, 6).join("\n"));
  process.exit(1);
});
