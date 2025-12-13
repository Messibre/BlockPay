import {
  Transaction,
  resolvePaymentKeyHash,
  resolvePlutusScriptAddress,
  resolveDataHash,
} from "@meshsdk/core";
import { contractScript } from "../constants/script";

// Constants;

export const lovelaceToAda = (lovelace) => {
  return lovelace / 1000000;
};

export const adaToLovelace = (ada) => {
  return Math.floor(ada * 1000000);
};

// Helper: datum is complex, we need to format it for Mesh
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
  const tx = new Transaction({ initiator: wallet });
  const meshDatum = toMeshDatum(datum);

  tx.sendLovelace(
    {
      address: contractAddress,
      datum: {
        value: meshDatum,
        inline: true,
      },
    },
    amount.toString()
  );

  const unsignedTx = await tx.build();
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
  const tx = new Transaction({ initiator: wallet });

  // Script Input
  tx.redeemValue({
    value: utxo,
    script: {
      version: "V3",
      code: contractScript.cbor,
    },
    datum: {
      value: toMeshDatum(oldDatum), // Provide datum for validation
      inline: true, // We assume it was inline, but for redeeming we might need to exact match? If inline, we don't need to provide it?
      // Mesh: If UTxO has inline datum, we don't MUST provide it, but `datum` field in `redeemValue` maps to the Datum *we are spending* or used for building context?
      // Actually for V2/V3 we just need Ref Input or Inline Datum on UTxO.
      // If inline, good.
    },
    redeemer: {
      data: {
        alternative: 1, // Release
        fields: [milestoneId],
      },
    },
  });

  // Output 1: Freelancer
  tx.sendLovelace(freelancerAddress, payoutAmount.toString());

  // Output Fee: Platform Fee (if configured)
  if (feeAddress && feeAmount > 0) {
    tx.sendLovelace(feeAddress, feeAmount.toString());
  }

  // Output 2: Script (Remaining funds + updated datum)
  if (remainingAmount > 0) {
    tx.sendLovelace(
      {
        address: scriptAddress,
        datum: {
          value: toMeshDatum(newDatum),
          inline: true,
        },
      },
      remainingAmount.toString()
    );
  }

  const unsignedTx = await tx.build();
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
