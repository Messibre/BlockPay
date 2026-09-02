// Recovery script for funds stuck at the BROKEN escrow script address.
//
// WHY THIS WORKS: the deployed script (hash 2fce998d...) was compiled against
// a stub `Transaction` type with `extra_signatories` at field index 0. At
// runtime, real TxInfo index 0 holds `inputs`, so every signature-checking
// redeemer (Release/Withdraw/Refund/Arbitrate) crashes with unBData(Input).
// The `Deposit` branch returns True WITHOUT touching those fields, so a
// spend with redeemer Constr 0 [] validates. We use it to recover deposits.
//
// SECURITY NOTE: this also means ANYONE can spend from the old address.
// It must be abandoned; the client now uses the rebuilt contract.
//
// Usage:
//   RECOVER_UTXOS="txhash#0,txhash#1" RECOVER_TO=addr_test1... \
//     npx vite-node scripts/recover-stuck-escrow.mjs

import {
  MeshWallet,
  MeshTxBuilder,
  BlockfrostProvider,
} from "@meshsdk/core";
import { OfflineEvaluator } from "@meshsdk/core-csl";
import fs from "node:fs";
import { contractScript } from "../src/constants/script";

const log = (...a) => console.log("[recover]", ...a);

const BLOCKFROST_KEY =
  process.env.VITE_BLOCKFROST_KEY || process.env.BLOCKFROST_KEY;
const OLD_SCRIPT_ADDRESS =
  "addr_test1wqhuaxvd0x5dyunjlzmc7nsrxur4x5s9xlnvlrwjgefg0qstf3kqv";

const seeds = JSON.parse(
  fs.readFileSync("/vercel/share/blockpay-test-wallets.json", "utf8"),
);

async function main() {
  const provider = new BlockfrostProvider(BLOCKFROST_KEY);
  const evaluator = new OfflineEvaluator(provider, "preprod");

  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: provider,
    submitter: provider,
    key: { type: "mnemonic", words: seeds.client.mnemonic },
  });
  await wallet.init();
  const changeAddress = await wallet.getChangeAddress();
  const recoverTo = process.env.RECOVER_TO || changeAddress;

  // Which script UTXOs to recover
  const refs = (process.env.RECOVER_UTXOS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [txHash, idx] = s.split("#");
      return { txHash, outputIndex: Number(idx) };
    });
  if (refs.length === 0) {
    console.error("Set RECOVER_UTXOS=txhash#idx[,txhash#idx...]");
    process.exit(1);
  }

  // Resolve the script UTXOs (amounts) from the chain
  const scriptUtxos = await provider.fetchAddressUTxOs(OLD_SCRIPT_ADDRESS);
  const targets = refs.map((r) => {
    const u = scriptUtxos.find(
      (x) =>
        x.input.txHash === r.txHash && x.input.outputIndex === r.outputIndex,
    );
    if (!u) throw new Error(`UTXO not found at script: ${r.txHash}#${r.outputIndex}`);
    return u;
  });
  const totalLovelace = targets.reduce((acc, u) => {
    const l = u.output.amount.find((a) => a.unit === "lovelace");
    return acc + Number(l.quantity);
  }, 0);
  log(`recovering ${targets.length} UTXO(s), total ${totalLovelace / 1e6} ADA -> ${recoverTo}`);

  const walletUtxos = JSON.parse(JSON.stringify(await wallet.getUtxos()));

  // Collateral: reserved, or fall back to a pure-ADA UTXO >= 5 ADA
  const reserved = await wallet.getCollateral();
  let collateral = reserved && reserved[0];
  if (!collateral) {
    collateral = walletUtxos.find((u) => {
      const amt = u?.output?.amount || [];
      return (
        amt.length === 1 &&
        amt[0].unit === "lovelace" &&
        Number(amt[0].quantity) >= 5_000_000
      );
    });
  }
  if (!collateral) throw new Error("no collateral-capable UTXO in wallet");

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    evaluator,
    verbose: false,
  });

  // Spend each stuck escrow UTXO with the Deposit redeemer (Constr 0 [])
  for (const u of targets) {
    txBuilder
      .spendingPlutusScriptV3()
      .txIn(
        u.input.txHash,
        u.input.outputIndex,
        u.output.amount,
        OLD_SCRIPT_ADDRESS,
      )
      .txInInlineDatumPresent()
      .txInRedeemerValue({ alternative: 0, fields: [] })
      .txInScript(contractScript.cbor);
  }

  txBuilder
    .txOut(recoverTo, [
      { unit: "lovelace", quantity: String(totalLovelace - 2_000_000) },
    ])
    .txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address,
    )
    .changeAddress(changeAddress)
    .selectUtxosFrom(walletUtxos)
    .setNetwork("preprod");

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTx(unsignedTx);
  fs.writeFileSync("/tmp/recovery-tx.hex", signedTx);
  log("built + signed. submitting...");
  const txHash = await wallet.submitTx(signedTx);
  log("RECOVERY SUBMITTED:", txHash);
  log(`https://preprod.cardanoscan.io/transaction/${txHash}`);
}

main().catch((e) => {
  console.error("[recover] FAILED:", e?.message || e);
  process.exit(1);
});
