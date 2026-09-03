import {
  MeshTxBuilder,
  resolvePaymentKeyHash,
  resolvePlutusScriptAddress,
  resolveDataHash,
  BlockfrostProvider,
  unixTimeToEnclosingSlot,
  SLOT_CONFIG_NETWORK,
  deserializeDatum,
} from "@meshsdk/core";
import { contractScript } from "../constants/script";

// Optionally load the local Aiken-VM evaluator (@meshsdk/core-csl). It is a
// WASM package that Vite cannot bundle for the browser, so it is imported
// lazily with @vite-ignore: available in Node (tests/scripts), and silently
// falling back to the Blockfrost evaluator in the browser build.
const getEvaluator = async (provider, network) => {
  try {
    const mod = await import(/* @vite-ignore */ "@meshsdk/core-csl");
    if (mod?.OfflineEvaluator) {
      return new mod.OfflineEvaluator(provider, network);
    }
  } catch {
    /* core-csl unavailable in this environment; use remote evaluator */
  }
  return provider;
};

// Resolve the Blockfrost key in both Vite (import.meta.env) and Node
// (process.env) so the same code path can be exercised by tests/scripts.
const getBlockfrostKey = () => {
  try {
    if (import.meta.env && import.meta.env.VITE_BLOCKFROST_KEY) {
      return import.meta.env.VITE_BLOCKFROST_KEY;
    }
  } catch {
    /* not running under Vite */
  }
  if (globalThis.process?.env?.VITE_BLOCKFROST_KEY) {
    return globalThis.process.env.VITE_BLOCKFROST_KEY;
  }
  return undefined;
};

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

    // Aiken: Withdraw(ByteArray) -> Constr 2 [ByteArray] (the milestone id is
    // a bare ByteArray field, NOT wrapped in another constructor)
    return {
      alternative: 2,
      fields: [hex],
    };
  }, // Aiken: Refund -> Constr 3 []

  refund: () => {
    return {
      alternative: 3,
      fields: [],
    };
  }, // Aiken: Arbitrate(ArbitrateDecision) -> Constr 4 [ArbitrateDecision]

  // Aiken: Arbitrate(ArbitrateDecision) -> Constr 4 [decision]
  // PayFull -> Constr 0 [], PayPartial(Int) -> Constr 1 [amount],
  // RefundFull -> Constr 2 [], RefundPartial(Int) -> Constr 3 [amount]
  arbitrate: (decision, partialAmountLovelace) => {
    const decisionMap = {
      PayFull: 0,
      PayPartial: 1,
      RefundFull: 2,
      RefundPartial: 3,
    };
    const decisionIndex =
      typeof decision === "string" ? decisionMap[decision] : decision;

    // Partial decisions carry an Int (lovelace) field in the validator
    const isPartial = decisionIndex === 1 || decisionIndex === 3;
    if (isPartial && partialAmountLovelace == null) {
      throw new Error(
        "PayPartial/RefundPartial require a partial amount in lovelace",
      );
    }

    return {
      alternative: 4,
      fields: [
        {
          alternative: decisionIndex,
          fields: isPartial ? [BigInt(partialAmountLovelace)] : [],
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
      // Validator expects expiration as POSIXTime in MILLISECONDS. The
      // backend stores a Date which serializes to an ISO string over JSON -
      // BigInt(isoString) would throw, so coerce through Date.getTime().
      d.expiration
        ? {
            alternative: 0,
            fields: [
              BigInt(
                typeof d.expiration === "number"
                  ? Math.floor(d.expiration)
                  : new Date(d.expiration).getTime(),
              ),
            ],
          }
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
  const blockfrostProvider = new BlockfrostProvider(getBlockfrostKey());
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
  const scriptObject = { code: contractScript.cbor, version: "V3" };
  const derivedAddress = resolvePlutusScriptAddress(scriptObject, 0);
  if (
    derivedAddress !== scriptAddress ||
    derivedAddress !== formattedUtxo.output.address
  ) {
    throw new Error(
      "Escrow UTxO address does not match the configured validator script.",
    );
  }
  // Initialize MeshTxBuilder.
  // Prefer the LOCAL OfflineEvaluator (real Aiken VM, precise error messages)
  // when available (Node scripts/tests); fall back to Blockfrost's remote
  // evaluator in the browser where the WASM evaluator cannot be bundled.
  const blockfrostProvider = new BlockfrostProvider(getBlockfrostKey());
  const network =
    globalThis.process?.env?.VITE_NETWORK ||
    (() => {
      try {
        return import.meta.env?.VITE_NETWORK;
      } catch {
        return undefined;
      }
    })() ||
    "preprod";
  const evaluator = await getEvaluator(blockfrostProvider, network);

  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    evaluator,
    verbose: false,
  }); // Manually fetch and provide UTXOs to the builder

  const walletUtxos = await wallet.getUtxos();
  const cleanUtxos = JSON.parse(JSON.stringify(walletUtxos));
  txBuilder.selectUtxosFrom(cleanUtxos); // Set Collateral (Required for Plutus V3 transactions)

  // Collateral is MANDATORY for Plutus script spends. Without it the tx body
  // has no collateral field and evaluation/submission fails. Eternl returns []
  // from getCollateral() unless the user reserved collateral in settings, so
  // fall back to a pure-ADA wallet UTXO. Required collateral is only ~150% of
  // the tx fee (~0.4-1 ADA), so prefer a UTXO >= 5 ADA but accept anything
  // >= 1.5 ADA rather than failing.
  const collateralUtxos = await wallet.getCollateral();
  let collateral = collateralUtxos && collateralUtxos[0];

  if (!collateral) {
    const pureAda = cleanUtxos
      .filter((u) => {
        const amt = u?.output?.amount || [];
        return amt.length === 1 && amt[0].unit === "lovelace";
      })
      .sort(
        (a, b) =>
          Number(b.output.amount[0].quantity) -
          Number(a.output.amount[0].quantity),
      );
    collateral =
      pureAda.find((u) => Number(u.output.amount[0].quantity) >= 5_000_000) ||
      pureAda.find((u) => Number(u.output.amount[0].quantity) >= 1_500_000);
  }

  if (!collateral) {
    throw new Error(
      "No collateral available. Enable/reserve collateral in your wallet " +
        "settings (Eternl: Wallet > Collateral), or keep a pure-ADA UTXO of " +
        "at least 1.5 ADA in your wallet, then try again.",
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

// Read inline datum CBOR from either Mesh or Blockfrost UTxO shapes.
export const getInlineDatumCbor = (utxo) =>
  utxo?.output?.plutusData ||
  utxo?.plutusData ||
  utxo?.inline_datum ||
  utxo?.inlineDatum ||
  (typeof utxo?.datum === "string" && utxo.datum.length > 64
    ? utxo.datum
    : null) ||
  null;

const utf8FromHex = (hex, field) => {
  if (typeof hex !== "string" || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error(`Invalid ${field} bytes in escrow datum`);
  }
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)?.map((part) => Number.parseInt(part, 16)) || [],
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
};

const requireField = (value, type, field) => {
  if (!value || typeof value !== "object" || !(type in value)) {
    throw new Error(`Malformed escrow datum: missing ${field}`);
  }
  return value[type];
};

/**
 * Strictly decode the validator's EscrowDatum from inline CBOR. Payment-key
 * hashes stay as hashes: callers must prove their known Bech32 addresses map
 * to these values before constructing a spend.
 */
export const parseEscrowDatum = (inlineDatumCbor) => {
  if (!inlineDatumCbor) throw new Error("Escrow UTxO has no inline datum");

  const decoded = deserializeDatum(inlineDatumCbor);
  if (String(decoded?.constructor) !== "0" || decoded?.fields?.length !== 9) {
    throw new Error("Escrow UTxO has an incompatible datum shape");
  }

  const fields = decoded.fields;
  const milestonesRaw = requireField(fields[3], "list", "milestones");
  const milestones = milestonesRaw.map((item, index) => {
    if (String(item?.constructor) !== "0" || item?.fields?.length !== 3) {
      throw new Error(`Malformed escrow milestone at index ${index}`);
    }
    const paidConstructor = String(
      requireField(item.fields[2], "constructor", `milestones[${index}].paid`),
    );
    if (paidConstructor !== "0" && paidConstructor !== "1") {
      throw new Error(`Invalid paid flag at milestone index ${index}`);
    }
    return {
      id: utf8FromHex(
        requireField(item.fields[0], "bytes", `milestones[${index}].id`),
        `milestones[${index}].id`,
      ),
      amount: Number(
        requireField(item.fields[1], "int", `milestones[${index}].amount`),
      ),
      paid: paidConstructor === "1",
    };
  });

  if (milestones.some((m) => !Number.isSafeInteger(m.amount) || m.amount <= 0)) {
    throw new Error("Escrow datum contains an invalid milestone amount");
  }

  const expirationField = fields[7];
  const expirationConstructor = String(expirationField?.constructor);
  let expiration = null;
  if (expirationConstructor === "0") {
    expiration = Number(
      requireField(expirationField.fields?.[0], "int", "expiration"),
    );
  } else if (expirationConstructor !== "1") {
    throw new Error("Escrow datum contains an invalid expiration");
  }

  const parsed = {
    clientHash: requireField(fields[0], "bytes", "client"),
    freelancerHash: requireField(fields[1], "bytes", "freelancer"),
    total_amount: Number(requireField(fields[2], "int", "total_amount")),
    milestones,
    contract_nonce: Number(
      requireField(fields[4], "int", "contract_nonce"),
    ),
    fee_percent: Number(requireField(fields[5], "int", "fee_percent")),
    feeAddressHash: requireField(fields[6], "bytes", "fee_address"),
    expiration,
    arbitratorHash: requireField(fields[8], "bytes", "arbitrator"),
  };

  if (
    !Number.isSafeInteger(parsed.total_amount) ||
    !Number.isSafeInteger(parsed.contract_nonce) ||
    !Number.isSafeInteger(parsed.fee_percent)
  ) {
    throw new Error("Escrow datum contains unsafe numeric values");
  }
  return parsed;
};

// Find this contract's CURRENT escrow UTxO. Deposit hashes only identify the
// initial output; continuation outputs are identified by immutable datum keys.
export const findEscrowUtxo = (
  utxos,
  { milestoneId, clientAddress, contractNonce } = {},
) => {
  if (!utxos || utxos.length === 0) return null;

  let clientHash = null;
  try {
    clientHash = clientAddress
      ? resolvePaymentKeyHash(clientAddress).toLowerCase()
      : null;
  } catch {
    return null;
  }

  const matches = utxos.flatMap((utxo) => {
    try {
      const datum = parseEscrowDatum(getInlineDatumCbor(utxo));
      const identityMatches =
        (!clientHash || datum.clientHash.toLowerCase() === clientHash) &&
        (contractNonce == null ||
          datum.contract_nonce === Number(contractNonce)) &&
        (!milestoneId || datum.milestones.some((m) => m.id === milestoneId));
      return identityMatches ? [{ utxo, datum }] : [];
    } catch {
      return [];
    }
  });

  if (matches.length > 1) {
    throw new Error(
      "Multiple escrow UTxOs match this contract nonce. Refusing an ambiguous spend.",
    );
  }
  if (matches.length === 0) return null;

  // Attach decoded state without changing the provider's UTxO shape.
  return { ...matches[0].utxo, escrowDatum: matches[0].datum };
};

// Shared setup for transactions that SPEND from the escrow script:
// builder + wallet UTXO selection + mandatory Plutus collateral.
const setupScriptSpend = async (wallet) => {
  const blockfrostProvider = new BlockfrostProvider(getBlockfrostKey());
  const network =
    globalThis.process?.env?.VITE_NETWORK ||
    (() => {
      try {
        return import.meta.env?.VITE_NETWORK;
      } catch {
        return undefined;
      }
    })() ||
    "preprod";
  const evaluator = await getEvaluator(blockfrostProvider, network);

  const txBuilder = new MeshTxBuilder({
    fetcher: blockfrostProvider,
    evaluator,
    verbose: false,
  });

  const walletUtxos = await wallet.getUtxos();
  const cleanUtxos = JSON.parse(JSON.stringify(walletUtxos));
  txBuilder.selectUtxosFrom(cleanUtxos);

  // Collateral is MANDATORY for Plutus script spends (same policy as
  // buildReleaseTransaction: reserved collateral first, then a pure-ADA UTXO).
  const collateralUtxos = await wallet.getCollateral();
  let collateral = collateralUtxos && collateralUtxos[0];
  if (!collateral) {
    const pureAda = cleanUtxos
      .filter((u) => {
        const amt = u?.output?.amount || [];
        return amt.length === 1 && amt[0].unit === "lovelace";
      })
      .sort(
        (a, b) =>
          Number(b.output.amount[0].quantity) -
          Number(a.output.amount[0].quantity),
      );
    collateral =
      pureAda.find((u) => Number(u.output.amount[0].quantity) >= 5_000_000) ||
      pureAda.find((u) => Number(u.output.amount[0].quantity) >= 1_500_000);
  }
  if (!collateral) {
    throw new Error(
      "No collateral available. Enable/reserve collateral in your wallet " +
        "settings (Eternl: Wallet > Collateral), or keep a pure-ADA UTXO of " +
        "at least 1.5 ADA in your wallet, then try again.",
    );
  }
  txBuilder.txInCollateral(
    collateral.input.txHash,
    collateral.input.outputIndex,
    collateral.output.amount,
    collateral.output.address,
  );

  return { txBuilder, network };
};

/**
 * Refund: client reclaims the escrow's remaining funds.
 * Validator rules (escrow.ak Refund):
 *  - client must sign
 *  - allowed when NO milestone is paid, OR
 *  - when milestones are paid: datum.expiration must be set AND the tx
 *    validity range's LOWER bound must be strictly after the expiration -
 *    i.e. the tx must set invalidBefore (afterExpiration = true).
 */
export const buildRefundTransaction = async (
  wallet,
  scriptAddress,
  currentDatum,
  refundAmountLovelace,
  clientAddress,
  formattedUtxo,
  { afterExpiration = false } = {},
) => {
  const { txBuilder, network } = await setupScriptSpend(wallet);

  // Client signs
  txBuilder.requiredSignerHash(resolvePaymentKeyHash(clientAddress));

  // Spend the escrow UTXO with the Refund redeemer
  txBuilder.spendingPlutusScriptV3();
  txBuilder.txIn(
    formattedUtxo.input.txHash,
    formattedUtxo.input.outputIndex,
    formattedUtxo.output.amount,
    formattedUtxo.output.address,
  );
  txBuilder.txInScript(contractScript.cbor);
  txBuilder.txInRedeemerValue(createRedeemerData.refund());
  txBuilder.txInInlineDatumPresent();

  // Expired-contract refunds REQUIRE a finite validity lower bound: the
  // validator checks lower_bound > expiration. Set invalidBefore to the slot
  // enclosing "now" (past the expiration by definition when afterExpiration).
  if (afterExpiration) {
    const expirationMs =
      typeof currentDatum.expiration === "number"
        ? currentDatum.expiration
        : new Date(currentDatum.expiration).getTime();
    if (!expirationMs || Date.now() <= expirationMs) {
      throw new Error(
        "Refund with paid milestones is only allowed AFTER the contract expiration.",
      );
    }
    const slotConfig = SLOT_CONFIG_NETWORK[network] || SLOT_CONFIG_NETWORK.preprod;
    const nowSlot = unixTimeToEnclosingSlot(Date.now(), slotConfig);
    txBuilder.invalidBefore(nowSlot);
  }

  // Return the full remaining escrow value to the client
  txBuilder.txOut(clientAddress, [
    { unit: "lovelace", quantity: refundAmountLovelace.toString() },
  ]);

  const changeAddress = await wallet.getChangeAddress();
  txBuilder.changeAddress(changeAddress);

  const unsignedTx = await txBuilder.complete();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);
  return txHash;
};

/**
 * Withdraw: freelancer claims funds for a milestone the on-chain datum marks
 * as paid (recovery path - the normal Release flow pays directly).
 * Validator rules (escrow.ak Withdraw): freelancer signs + milestone.paid.
 */
export const buildWithdrawTransaction = async (
  wallet,
  scriptAddress,
  milestoneId,
  currentDatum,
  withdrawAmountLovelace,
  freelancerAddress,
  remainingAmountLovelace,
  formattedUtxo,
) => {
  const { txBuilder } = await setupScriptSpend(wallet);

  // Freelancer signs
  txBuilder.requiredSignerHash(resolvePaymentKeyHash(freelancerAddress));

  txBuilder.spendingPlutusScriptV3();
  txBuilder.txIn(
    formattedUtxo.input.txHash,
    formattedUtxo.input.outputIndex,
    formattedUtxo.output.amount,
    formattedUtxo.output.address,
  );
  txBuilder.txInScript(contractScript.cbor);
  txBuilder.txInRedeemerValue(createRedeemerData.withdraw(milestoneId));
  txBuilder.txInInlineDatumPresent();

  // Payout to freelancer
  txBuilder.txOut(freelancerAddress, [
    { unit: "lovelace", quantity: withdrawAmountLovelace.toString() },
  ]);

  // Re-lock any remainder at the script with the SAME datum (the milestone is
  // already marked paid in it - nothing to update).
  if (remainingAmountLovelace > 0) {
    const script = { code: contractScript.cbor, version: "V3" };
    const actualScriptAddress = resolvePlutusScriptAddress(script, 0);
    txBuilder.txOut(actualScriptAddress, [
      { unit: "lovelace", quantity: remainingAmountLovelace.toString() },
    ]);
    txBuilder.txOutInlineDatumValue(toMeshDatum(currentDatum));
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
