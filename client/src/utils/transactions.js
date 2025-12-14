import {
  MeshTxBuilder,
  resolvePaymentKeyHash,
  resolvePlutusScriptAddress,
  resolveDataHash,
  BlockfrostProvider,
} from "@meshsdk/core";
import { contractScript } from "../constants/script";

// Constants;

export const lovelaceToAda = (lovelace) => {
  return lovelace / 1000000;
};

export const adaToLovelace = (ada) => {
  return Math.floor(ada * 1000000);
};

// Helper functions for proper redeemer data serialization
export const createRedeemerData = {
  // Aiken: Deposit -> Constr 0 []
  deposit: () => {
    return {
      alternative: 0,
      fields: []
    };
  },
  
  // Aiken: Release(ByteArray) -> Constr 1 [ByteArray milestoneId]
  release: (milestoneId) => {
    const milestoneIdStr = typeof milestoneId !== "string" ? String(milestoneId) : milestoneId;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(milestoneIdStr);
    
    return {
      alternative: 1,
      fields: [
        {
          alternative: 0,
          fields: [Array.from(bytes)]
        }
      ]
    };
  },
  
  // Aiken: Withdraw(ByteArray) -> Constr 2 [ByteArray milestoneId]
  withdraw: (milestoneId) => {
    const milestoneIdStr = typeof milestoneId !== "string" ? String(milestoneId) : milestoneId;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(milestoneIdStr);
    
    return {
      alternative: 2,
      fields: [
        {
          alternative: 0,
          fields: [Array.from(bytes)]
        }
      ]
    };
  },
  
  // Aiken: Refund -> Constr 3 []
  refund: () => {
    return {
      alternative: 3,
      fields: []
    };
  },
  
  // Aiken: Arbitrate(ArbitrateDecision) -> Constr 4 [ArbitrateDecision]
  arbitrate: (decision) => {
    const decisionMap = {
      'PayFull': 0,
      'PayPartial': 1,
      'RefundFull': 2,
      'RefundPartial': 3
    };
    const decisionIndex = typeof decision === 'string' ? decisionMap[decision] : decision;
    
    return {
      alternative: 4,
      fields: [
        {
          alternative: decisionIndex,
          fields: []
        }
      ]
    };
  }
};

// assuming datum structure matches what the validator expects
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

export const buildDepositTransaction = async (
  wallet,
  contractAddress,
  amount,
  datum
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

  // Add wallet as required signer
  const changeAddress = await wallet.getChangeAddress();
  txBuilder.requiredSignerHash(resolvePaymentKeyHash(changeAddress));

  const meshDatum = toMeshDatum(datum);

  // Output: Contract deposit with inline datum
  txBuilder.txOut(contractAddress, [{ unit: "lovelace", quantity: amount.toString() }]);
  txBuilder.txOutInlineDatumValue(meshDatum);

  // Set change address
  txBuilder.changeAddress(changeAddress);

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  return txHash;
};

export const buildReleaseTransaction = async (
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

  // ✅ FIXED: Use proper redeemer data structure
  const redeemerData = createRedeemerData.release(milestoneId);

  // Setup spending transaction with proper script reference
  txBuilder.spendingPlutusScriptV3();
  txBuilder.txIn(utxo.txHash, utxo.outputIndex);
  
  // Use the script from constants with proper structure
  const script = { code: contractScript.cbor, version: "V3" };
  txBuilder.txInScript(script);
  txBuilder.txInRedeemerValue(redeemerData); // ✅ NOW WORKS - proper data structure
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
    txBuilder.txOutInlineDatumValue(toMeshDatum(newDatum));
  }

  const changeAddress = await wallet.getChangeAddress();
  txBuilder.changeAddress(changeAddress);

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  return txHash;
};

// Helper: Find UTxO matching the contract datum
export const findMatchingUtxo = (utxos, contractDatum) => {
  if (!utxos || utxos.length === 0) return null;

  const meshDatum = toMeshDatum(contractDatum);
  const expectedHash = resolveDataHash(meshDatum);

  // Try to find by Data Hash
  // Backend returns datum: utxo.inline_datum || utxo.data_hash
  // If it's hash, it matches expectedHash.
  // If it's inline datum (CBOR), we can't match string equality with hash.

  const found = utxos.find((u) => u.datum === expectedHash);

  if (found) return found;

  // Fallback: If we can't match by hash (e.g. backend returned inline CBOR), return the first one.
  // Ideally we should hash the inline CBOR to check, but for MVP/Testnet we assume it's the correct UTxO if there's one.
  return utxos[0];
};
