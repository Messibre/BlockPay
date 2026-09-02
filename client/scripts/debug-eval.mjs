// Debug harness: builds the SAME release tx as buildReleaseTransaction but
// with manual redeemer budgets (no evaluator), so we can extract the full tx
// hex and get a second opinion from Blockfrost's Ogmios evaluator.
// DOES NOT SUBMIT ANYTHING.

import fs from "node:fs";
import {
  MeshWallet,
  MeshTxBuilder,
  BlockfrostProvider,
  resolvePaymentKeyHash,
} from "@meshsdk/core";
import { contractScript } from "../src/constants/script.js";

const BLOCKFROST_KEY = process.env.VITE_BLOCKFROST_KEY;
const provider = new BlockfrostProvider(BLOCKFROST_KEY);
const seeds = JSON.parse(
  fs.readFileSync("/vercel/share/blockpay-test-wallets.json", "utf8"),
);

const log = (...a) => console.log("[dbg]", ...a);

const CONTRACT_ADDR =
  "addr_test1wqhuaxvd0x5dyunjlzmc7nsrxur4x5s9xlnvlrwjgefg0qstf3kqv";
const DEPOSIT_TX =
  "b0c0a50df170b9f638ef646b751fcc025edac3dc46cd727d9e68ceebf70b4baf";

const toHexBytes = (s) =>
  Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function main() {
  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words: seeds.client.mnemonic },
  });
  await wallet.init();

  const clientAddr = seeds.client.address;
  const freelancerAddr = seeds.freelancer.address;

  // Reconstruct the datum exactly as the e2e run did (from the contract doc)
  const contract = JSON.parse(
    fs.readFileSync("/tmp/e2e-contract.json", "utf8"),
  );
  const cd = contract.datum;
  const oldDatumMesh = {
    alternative: 0,
    fields: [
      resolvePaymentKeyHash(clientAddr),
      resolvePaymentKeyHash(freelancerAddr),
      BigInt(cd.totalAmount),
      cd.milestones.map((m) => ({
        alternative: 0,
        fields: [
          toHexBytes(m.id),
          BigInt(m.amount),
          { alternative: m.paid ? 1 : 0, fields: [] },
        ],
      })),
      BigInt(cd.contractNonce),
      BigInt(cd.feePercent),
      resolvePaymentKeyHash(cd.feeAddress),
      { alternative: 1, fields: [] },
      resolvePaymentKeyHash(clientAddr),
    ],
  };
  const newDatumMesh = JSON.parse(
    JSON.stringify(oldDatumMesh, (k, v) =>
      typeof v === "bigint" ? Number(v) : v,
    ),
  );
  // mark ms-001 paid
  newDatumMesh.fields[3][0].fields[2] = { alternative: 1, fields: [] };
  // restore BigInts
  newDatumMesh.fields[2] = BigInt(cd.totalAmount);
  newDatumMesh.fields[4] = BigInt(cd.contractNonce);
  newDatumMesh.fields[5] = BigInt(cd.feePercent);
  for (const m of newDatumMesh.fields[3]) m.fields[1] = BigInt(6000000);

  const escrowUtxo = {
    input: { txHash: DEPOSIT_TX, outputIndex: 0 },
    output: {
      address: CONTRACT_ADDR,
      amount: [{ unit: "lovelace", quantity: "12000000" }],
    },
  };

  const walletUtxos = await wallet.getUtxos();
  const cleanUtxos = JSON.parse(JSON.stringify(walletUtxos));
  const collateral = cleanUtxos.find((u) => {
    const amt = u?.output?.amount || [];
    return (
      amt.length === 1 &&
      amt[0].unit === "lovelace" &&
      Number(amt[0].quantity) >= 5_000_000
    );
  });
  log("collateral:", collateral.input.txHash + "#" + collateral.input.outputIndex);

  const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: false });
  txBuilder.selectUtxosFrom(cleanUtxos);
  txBuilder.txInCollateral(
    collateral.input.txHash,
    collateral.input.outputIndex,
    collateral.output.amount,
    collateral.output.address,
  );
  txBuilder.requiredSignerHash(resolvePaymentKeyHash(clientAddr));

  const redeemer = { alternative: 1, fields: [toHexBytes("ms-001")] };

  txBuilder.spendingPlutusScriptV3();
  txBuilder.txIn(
    escrowUtxo.input.txHash,
    escrowUtxo.input.outputIndex,
    escrowUtxo.output.amount,
    escrowUtxo.output.address,
  );
  txBuilder.txInScript(contractScript.cbor);
  // Manual budget: generous but under limits, so NO evaluator runs.
  txBuilder.txInRedeemerValue(redeemer, "Mesh", {
    mem: 500000,
    steps: 200000000,
  });
  txBuilder.txInInlineDatumPresent();

  txBuilder.txOut(freelancerAddr, [
    { unit: "lovelace", quantity: "5940000" },
  ]);
  txBuilder.txOut(CONTRACT_ADDR, [
    { unit: "lovelace", quantity: "6000000" },
  ]);
  txBuilder.txOutInlineDatumValue(newDatumMesh);
  txBuilder.changeAddress(await wallet.getChangeAddress());

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTx(unsignedTx);
  fs.writeFileSync("/tmp/release-tx.hex", signedTx);
  log("signed tx built, length:", signedTx.length);

  // Second opinion: Blockfrost Ogmios evaluator
  const res = await fetch(
    "https://cardano-preprod.blockfrost.io/api/v0/utils/txs/evaluate",
    {
      method: "POST",
      headers: { project_id: BLOCKFROST_KEY, "content-type": "application/cbor" },
      body: signedTx,
    },
  );
  const verdict = await res.json();
  log("OGMIOS VERDICT:", JSON.stringify(verdict, null, 1).slice(0, 2000));
}

main().catch((e) => {
  console.error("[dbg] FAILED:", e?.message || e);
  process.exit(1);
});
