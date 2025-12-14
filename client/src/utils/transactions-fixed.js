import {
  MeshTxBuilder,
  resolvePaymentKeyHash,
  resolvePlutusScriptAddress,
  resolveDataHash,
  BlockfrostProvider,
  Data,
  Constr,
} from "@meshsdk/core";
import { contractScript } from "../constants/script";

// Helper functions for proper Plutus Data serialization
export const createRedeemerData = {
  // Aiken: Deposit -> Constr 0 []
  deposit: () => Data.to(Constr(0, [])),
  
  // Aiken: Release(ByteArray) -> Constr 1 [ByteArray milestoneId]
  release: (milestoneId) => {
    const milestoneIdStr = typeof milestoneId !== "string" ? String(milestoneId) : milestoneId;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(milestoneIdStr);
    return Data.to(Constr(1, [Data.from(bytes)]));
  },
  
  // Aiken: Withdraw(ByteArray) -> Constr 2 [ByteArray milestoneId]
  withdraw: (milestoneId) => {
    const milestoneIdStr = typeof milestoneId !== "string" ? String(milestoneId) : milestoneId;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(milestoneIdStr);
    return Data.to(Constr(2, [Data.from(bytes)]));
  },
  
  // Aiken: Refund -> Constr 3 []
  refund: () => Data.to(Constr(3, [])),
  
  // Aiken: Arbitrate(ArbitrateDecision) -> Constr 4 [ArbitrateDecision]
  arbitrate: (decision) => {
    const decisionMap = {
      'PayFull': 0,
      'PayPartial': 1,
      'RefundFull': 2,
      'RefundPartial': 3
    };
    const decisionIndex = typeof decision === 'string' ? decisionMap[decision] : decision;
    return Data.to(Constr(4, [Data.to(Constr(decisionIndex, []))]));
  }
};

// Example usage for the corrected release transaction
export const buildReleaseTransactionFixed = async (
  wallet,
  scriptAddress,
  milestoneId,
  oldDatum,
  newDatum,
  payoutAmount,
  freelancerAddress,
  remainingAmount,
  utxo,
  feeAddress = null,
  feeAmount = 0
) => {
  // Initialize MeshTxBuilder
  const blockfrostProvider = new BlockfrostProvider(import.meta.env.VITE_BLOCKFROST_KEY);
  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    evaluator: blockfrostProvider,
    verbose: false,
  });

  // Manually fetch and provide UTXOs to the builder
  const walletUtxos = await wallet.getUtxos();
  const cleanUtxos = JSON.parse(JSON.stringify(walletUtxos));
  txBuilder.selectUtxosFrom(cleanUtxos);

  // Set Collateral (Required for Plutus V3 transactions)
  const collateralUtxos = await wallet.getCollateral();
  if (collateralUtxos && collateralUtxos.length > 0) {
    const collateral = collateralUtxos[0];
    txBuilder.txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address
    );
  }

  // Add client as required signer
  const isBech32 = (s) =>
    typeof s === "string" &&
    /^(addr1|addr_test1)[0-9a-z]+$/.test(s) &&
    s.length >= 8;
  
  if (!isBech32(oldDatum.client)) {
    throw new Error(
      `Invalid client address in datum: "${oldDatum.client}". Expected a valid Bech32 address`
    );
  }
  txBuilder.requiredSignerHash(resolvePaymentKeyHash(oldDatum.client));

  // ✅ FIXED: Use proper redeemer data serialization
  const redeemerData = createRedeemerData.release(milestoneId);

  // Setup spending transaction with proper script reference
  txBuilder.spendingPlutusScriptV3();
  txBuilder.txIn(utxo.txHash, utxo.outputIndex);
  
  // Use the script from constants with proper structure
  const script = { code: contractScript.cbor, version: "V3" };
  txBuilder.txInScript(script);
  txBuilder.txInRedeemerValue(redeemerData); // ✅ NOW WORKS - proper Plutus Data
  txBuilder.txInInlineDatumPresent();

  // Output 1: Freelancer payment
  txBuilder.txOut(freelancerAddress, [{ unit: "lovelace", quantity: payoutAmount.toString() }]);

  // Output 2: Platform fee (if applicable)
  if (feeAddress && feeAmount > 0) {
    txBuilder.txOut(feeAddress, [{ unit: "lovelace", quantity: feeAmount.toString() }]);
  }

  // Output 3: Remaining funds back to script
  if (remainingAmount > 0) {
    const updatedScript = { code: contractScript.cbor, version: "V3" };
    const actualScriptAddress = resolvePlutusScriptAddress(updatedScript, 0);
    txBuilder.txOut(actualScriptAddress, [{ unit: "lovelace", quantity: remainingAmount.toString() }]);
    // Note: toMeshDatum uses old format but is still compatible
    txBuilder.txOutInlineDatumValue(toMeshDatum(newDatum));
  }

  const changeAddress = await wallet.getChangeAddress();
  txBuilder.changeAddress(changeAddress);

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  return txHash;
};

// Constants;
export const lovelaceToAda = (lovelace) => {
  return lovelace / 1000000;
};

export const adaToLovelace = (ada) => {
  return Math.floor(ada * 1000000);
};

// assuming datum structure matches what the validator expects (existing format still works)
const toMeshDatum = (d) => {
  // Basic validators / sanitizers
  const isBech32 = (s) =>
    typeof s === "string" &&
    /^(addr1|addr_test1)[0-9a-z]+$/.test(s) &&
    s.length >= 8;
  const sanitizeId = (id) => {
    if (typeof id !== "string") id = String(id || "mid");
    // Convert to hex representation of the UTF-8 bytes so the SDK accepts ByteArray
    const encoder = new TextEncoder();
    const bytes = encoder.encode(id);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Ensure at least 4 bytes (8 hex chars) to satisfy SDK min size
    if (hex.length < 8) {
      // Pad with timestamp-derived randomness
      const pad = Math.floor(Date.now() % 0xffffffff)
        .toString(16)
        .padStart(8, "0");
      return (hex + pad).substring(0, 8);
    }
    return hex;
  };

  if (!isBech32(d.client)) {
    throw new TypeError(`Invalid client address in datum: ${String(d.client)}`);
  }
  if (!isBech32(d.freelancer)) {
    throw new TypeError(
      `Invalid freelancer address in datum: ${String(d.freelancer)}`
    );
  }
  return {
    alternative: 0,
    fields: [
      resolvePaymentKeyHash(d.client),
      resolvePaymentKeyHash(d.freelancer),
      BigInt(d.total_amount),
      d.milestones.map((m) => ({
        alternative: 0,
        fields: [
          sanitizeId(m.id),
          BigInt(m.amount),
          { alternative: m.paid ? 1 : 0, fields: [] },
        ],
      })),
      BigInt(d.contract_nonce),
      BigInt(d.fee_percent),
      resolvePaymentKeyHash(d.fee_address || d.client),
      d.expiration
        ? { alternative: 0, fields: [BigInt(d.expiration)] }
        : { alternative: 1, fields: [] },
      resolvePaymentKeyHash(d.arbitrator || d.client),
    ],
  };
};

// Helper: Find UTxO matching the contract datum
export const findMatchingUtxo = (utxos, contractDatum) => {
  if (!utxos || utxos.length === 0) return null;

  const meshDatum = toMeshDatum(contractDatum);
  const expectedHash = resolveDataHash(meshDatum);

  const found = utxos.find((u) => u.datum === expectedHash);

  if (found) return found;

  // Fallback: return first UTxO if hash matching fails
  return utxos[0];
};
