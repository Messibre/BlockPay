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
      fields: [],
    };
  }, // Aiken: Release(ByteArray) -> Constr 1 [ByteArray milestoneId]

  release: (milestoneId) => {
    const milestoneIdStr =
      typeof milestoneId !== "string" ? String(milestoneId) : milestoneId;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(milestoneIdStr);

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      alternative: 1,
      fields: [hex],
    };
  }, // Aiken: Withdraw(ByteArray) -> Constr 2 [ByteArray milestoneId]

  withdraw: (milestoneId) => {
    const milestoneIdStr =
      typeof milestoneId !== "string" ? String(milestoneId) : milestoneId;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(milestoneIdStr);

    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      alternative: 2,
      fields: [
        {
          alternative: 0,
          fields: [hex],
        },
      ],
    };
  }, // Aiken: Refund -> Constr 3 []

  refund: () => {
    return {
      alternative: 3,
      fields: [],
    };
  }, // Aiken: Arbitrate(ArbitrateDecision) -> Constr 4 [ArbitrateDecision]

  arbitrate: (decision) => {
    const decisionMap = {
      PayFull: 0,
      PayPartial: 1,
      RefundFull: 2,
      RefundPartial: 3,
    };
    const decisionIndex =
      typeof decision === "string" ? decisionMap[decision] : decision;

    return {
      alternative: 4,
      fields: [
        {
          alternative: decisionIndex,
          fields: [],
        },
      ],
    };
  },
};

// assuming datum structure matches what the validator expects
const toMeshDatum = (d) => {
  // Basic validators / sanitizers
  const isBech32 = (s) =>
    typeof s === "string" &&
    /^(addr1|addr_test1)[0-9a-z]+$/.test(s) &&
    s.length >= 8;
  const sanitizeId = (id) => {
    if (typeof id !== "string") id = String(id || "mid"); // Convert to hex representation of the UTF-8 bytes so the SDK accepts ByteArray
    const encoder = new TextEncoder();
    const bytes = encoder.encode(id);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""); // Ensure at least 4 bytes (8 hex chars) to satisfy SDK min size
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
      `Invalid freelancer address in datum: ${String(d.freelancer)}`,
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
  datum,
) => {
  // Initialize MeshTxBuilder
  const blockfrostProvider = new BlockfrostProvider(
    import.meta.env.VITE_BLOCKFROST_KEY,
  );
  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    evaluator: blockfrostProvider,
    verbose: false,
  }); // Manually fetch and provide UTXOs to the builder

  const walletUtxos = await wallet.getUtxos();
  const cleanUtxos = JSON.parse(JSON.stringify(walletUtxos));
  txBuilder.selectUtxosFrom(cleanUtxos); // Set Collateral (Required for Plutus V3 transactions)

  const collateralUtxos = await wallet.getCollateral();
  if (collateralUtxos && collateralUtxos.length > 0) {
    const collateral = collateralUtxos[0];
    txBuilder.txInCollateral(
      collateral.input.txHash,
      collateral.input.outputIndex,
      collateral.output.amount,
      collateral.output.address,
    );
  } // Add wallet as required signer

  const changeAddress = await wallet.getChangeAddress();
  txBuilder.requiredSignerHash(resolvePaymentKeyHash(changeAddress)); // Ensure datum contains all required fields for the on-chain EscrowDatum

  const isBech32 = (s) =>
    typeof s === "string" &&
    /^(addr1|addr_test1)[0-9a-z]+$/.test(s) &&
    s.length >= 8;

  const normalizedDatum = {
    ...datum,
    fee_address: isBech32(datum?.fee_address)
      ? datum.fee_address
      : datum?.client,
    arbitrator: isBech32(datum?.arbitrator) ? datum.arbitrator : datum?.client,
    expiration: datum?.expiration ?? null,
  };

  if (!isBech32(normalizedDatum.client)) {
    throw new TypeError(
      `Invalid client address in datum: ${String(normalizedDatum.client)}`,
    );
  }
  if (!isBech32(normalizedDatum.freelancer)) {
    throw new TypeError(
      `Invalid freelancer address in datum: ${String(normalizedDatum.freelancer)}`,
    );
  }
  if (!isBech32(normalizedDatum.fee_address)) {
    throw new TypeError(
      `Invalid fee address in datum: ${String(normalizedDatum.fee_address)}`,
    );
  }
  if (!isBech32(normalizedDatum.arbitrator)) {
    throw new TypeError(
      `Invalid arbitrator address in datum: ${String(normalizedDatum.arbitrator)}`,
    );
  }

  const meshDatum = toMeshDatum(normalizedDatum); // Output: Contract deposit with inline datum

  txBuilder.txOut(contractAddress, [
    { unit: "lovelace", quantity: amount.toString() },
  ]);
  txBuilder.txOutInlineDatumValue(meshDatum); // Set change address

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
  formattedUtxo,
  feeAddress = null,
  feeAmount = 0,
) => {
  // Inside buildReleaseTransaction...
  try {
    // We manually format the script object so Mesh knows exactly what it is
    const scriptObject = {
      code: contractScript.cbor,
      version: "V3",
    };

    const derivedAddress = resolvePlutusScriptAddress(scriptObject, 0); // 0 for testnet

    console.log("✅ Derived Address:", derivedAddress);
    console.log("🏦 UTXO Address:   ", formattedUtxo.output.address);

    if (derivedAddress === formattedUtxo.output.address) {
      console.log("✨ PERFECT MATCH!");
    } else {
      console.error("❌ MISMATCH: Your CBOR is for a different address.");
    }
  } catch (e) {
    console.error("❌ Derivation failed:", e.message);
  }

  console.log(
    "DEBUG: Using Script CBOR:",
    contractScript.cbor.slice(0, 20) + "...",
  );
  // Initialize MeshTxBuilder
  const blockfrostProvider = new BlockfrostProvider(
    import.meta.env.VITE_BLOCKFROST_KEY,
  );

  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    evaluator: blockfrostProvider,
    verbose: false,
  }); // Manually fetch and provide UTXOs to the builder

  const walletUtxos = await wallet.getUtxos();
  console.log("wallet utxos", walletUtxos);
  const cleanUtxos = JSON.parse(JSON.stringify(walletUtxos));
  console.log("cleaned", cleanUtxos);
  txBuilder.selectUtxosFrom(cleanUtxos); // Set Collateral (Required for Plutus V3 transactions)

  // Collateral is MANDATORY for Plutus script spends. Without it the tx body
  // has no collateral field and Ogmios/Blockfrost evaluation fails with an
  // empty "ScriptFailures: {}" error. Eternl returns [] from getCollateral()
  // unless the user reserved collateral in wallet settings, so fall back to
  // a pure-ADA wallet UTXO (>= 5 ADA, no native tokens).
  const collateralUtxos = await wallet.getCollateral();
  let collateral = collateralUtxos && collateralUtxos[0];

  if (!collateral) {
    collateral = cleanUtxos.find((u) => {
      const amt = u?.output?.amount || [];
      return (
        amt.length === 1 &&
        amt[0].unit === "lovelace" &&
        Number(amt[0].quantity) >= 5_000_000
      );
    });
    if (collateral) {
      console.log(
        "ℹ️ Wallet has no reserved collateral; using a pure-ADA UTXO as collateral:",
        collateral.input.txHash + "#" + collateral.input.outputIndex,
      );
    }
  }

  if (!collateral) {
    throw new Error(
      "No collateral available. Enable/reserve collateral in your wallet " +
        "settings (Eternl: Wallet > Collateral), or keep a pure-ADA UTXO of " +
        "at least 5 ADA in your wallet, then try again.",
    );
  }

  txBuilder.txInCollateral(
    collateral.input.txHash,
    collateral.input.outputIndex,
    collateral.output.amount,
    collateral.output.address,
  ); // Add client as required signer

  const isBech32 = (s) =>
    typeof s === "string" &&
    /^(addr1|addr_test1)[0-9a-z]+$/.test(s) &&
    s.length >= 8;

  if (!isBech32(oldDatum.client)) {
    throw new Error(
      `Invalid client address in datum: "${oldDatum.client}". Expected a valid Bech32 address`,
    );
  }
  txBuilder.requiredSignerHash(resolvePaymentKeyHash(oldDatum.client)); // ✅ FIXED: Use proper redeemer data structure

  const redeemerData = createRedeemerData.release(milestoneId); // Setup spending transaction with proper script reference

  txBuilder.spendingPlutusScriptV3();
  console.log(txBuilder.txIn);
  txBuilder.txIn(
    formattedUtxo.input.txHash,
    formattedUtxo.input.outputIndex,
    formattedUtxo.output.amount, // Evaluator needs to know how much is in the formattedUtxo
    formattedUtxo.output.address,
  ); // Use the script from constants with proper structure
  // Use the script from constants

  txBuilder.txInScript(contractScript.cbor);
  txBuilder.txInRedeemerValue(redeemerData); // ✅ NOW WORKS - proper data structure
  txBuilder.txInInlineDatumPresent(); // Output 1: Freelancer payment

  txBuilder.txOut(freelancerAddress, [
    { unit: "lovelace", quantity: payoutAmount.toString() },
  ]); // Output 2: Platform fee (if applicable)

  // Cardano requires every output to hold ~1 ADA minimum (min-UTXO rule).
  // A tiny platform fee (e.g. 0.03 ADA on a 3 ADA milestone) would make the
  // tx unsubmittable, so only add the fee output when it clears the minimum.
  const MIN_UTXO_LOVELACE = 1_000_000;
  if (feeAddress && feeAmount >= MIN_UTXO_LOVELACE) {
    txBuilder.txOut(feeAddress, [
      { unit: "lovelace", quantity: feeAmount.toString() },
    ]);
  } else if (feeAddress && feeAmount > 0) {
    console.log(
      `ℹ️ Skipping platform fee output of ${feeAmount} lovelace (below min-UTXO); fee stays with change.`,
    );
  } // Output 3: Remaining funds back to script

  if (remainingAmount > 0) {
    const updatedScript = { code: contractScript.cbor, version: "V3" };
    const actualScriptAddress = resolvePlutusScriptAddress(updatedScript, 0);
    txBuilder.txOut(actualScriptAddress, [
      { unit: "lovelace", quantity: remainingAmount.toString() },
    ]);
    txBuilder.txOutInlineDatumValue(toMeshDatum(newDatum));
  }

  const changeAddress = await wallet.getChangeAddress();
  txBuilder.changeAddress(changeAddress);

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  return txHash;
};

// Helper: Find the escrow UTxO belonging to THIS contract by inspecting
// each UTxO's inline datum CBOR. The correct UTxO's datum must contain the
// hex-encoded milestone id AND the client's payment key hash. This prevents
// spending an unrelated UTxO at the shared script address (there can be many
// contracts' deposits at the same address), which makes the validator fail.
export const findEscrowUtxo = (utxos, { milestoneId, clientAddress } = {}) => {
  if (!utxos || utxos.length === 0) return null;

  const toHex = (s) =>
    Array.from(new TextEncoder().encode(String(s)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const milestoneHex = milestoneId ? toHex(milestoneId).toLowerCase() : null;

  let clientHash = null;
  try {
    clientHash = clientAddress
      ? resolvePaymentKeyHash(clientAddress).toLowerCase()
      : null;
  } catch {
    clientHash = null;
  }

  const inlineDatumOf = (u) =>
    u?.output?.plutusData ||
    u?.plutusData ||
    u?.inline_datum ||
    (typeof u?.datum === "string" && u.datum.length > 64 ? u.datum : null) ||
    "";

  const matches = utxos.filter((u) => {
    const inline = String(inlineDatumOf(u)).toLowerCase();
    if (!inline) return false;
    const milestoneOk = milestoneHex ? inline.includes(milestoneHex) : true;
    const clientOk = clientHash ? inline.includes(clientHash) : true;
    return milestoneOk && clientOk;
  });

  // Prefer the largest matching UTxO (the funded escrow, not dust)
  if (matches.length > 1) {
    matches.sort((a, b) => {
      const lovelace = (u) => {
        const amt = u?.output?.amount || u?.amount || [];
        const l = Array.isArray(amt)
          ? amt.find((x) => x.unit === "lovelace")
          : null;
        return l ? Number(l.quantity) : 0;
      };
      return lovelace(b) - lovelace(a);
    });
  }

  return matches[0] || null;
};

// Helper: Find UTxO matching the contract datum
export const findMatchingUtxo = (utxos, contractDatum) => {
  if (!utxos || utxos.length === 0) return null;

  const meshDatum = toMeshDatum(contractDatum);
  const expectedHash = resolveDataHash(meshDatum); // Try to find by Data Hash
  // Backend returns datum: utxo.inline_datum || utxo.data_hash
  // If it's hash, it matches expectedHash.
  // If it's inline datum (CBOR), we can't match string equality with hash.

  const found = utxos.find((u) => {
    if (!u?.datum) return false; // If datum is already a hash, compare directly
    if (u.datum === expectedHash) return true; // If datum looks like CBOR (hex), hash it and compare
    if (typeof u.datum === "string" && /^[0-9a-fA-F]+$/.test(u.datum)) {
      try {
        return resolveDataHash(u.datum) === expectedHash;
      } catch {
        return false;
      }
    }
    return false;
  });

  if (found) return found; // Fallback: If we can't match by hash (e.g. backend returned inline CBOR), return the first one.
  // Ideally we should hash the inline CBOR to check, but for MVP/Testnet we assume it's the correct UTxO if there's one.

  return utxos[0];
};
