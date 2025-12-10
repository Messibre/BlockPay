import { getTransaction, getTransactionUtxos, getExplorerLink } from "./blockfrost.js";

/**
 * Verify that a transaction sent funds to a contract address with correct amount
 */
export const verifyDeposit = async (txHash, contractAddress, expectedAmount) => {
  try {
    const tx = await getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: "Transaction not found" };
    }

    if (tx.block === null) {
      return { valid: false, error: "Transaction not confirmed", status: "PENDING" };
    }

    const utxos = await getTransactionUtxos(txHash);
    if (!utxos) {
      return { valid: false, error: "UTxOs not found" };
    }

    // Check outputs for contract address
    const outputToContract = utxos.outputs?.find(
      (out) => out.address === contractAddress,
    );

    if (!outputToContract) {
      return { valid: false, error: "No output to contract address found" };
    }

    const amount = outputToContract.amount?.find((a) => a.unit === "lovelace")?.quantity;
    if (!amount || Number(amount) < expectedAmount) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount}, got ${amount || 0}`,
      };
    }

    return {
      valid: true,
      amount: Number(amount),
      blockTime: tx.block_time,
      blockHeight: tx.block_height,
      explorerLink: getExplorerLink(txHash),
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

/**
 * Verify a payout transaction
 */
export const verifyPayout = async (txHash, expectedRecipient, expectedAmount) => {
  try {
    const tx = await getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: "Transaction not found" };
    }

    if (tx.block === null) {
      return { valid: false, error: "Transaction not confirmed", status: "PENDING" };
    }

    const utxos = await getTransactionUtxos(txHash);
    if (!utxos) {
      return { valid: false, error: "UTxOs not found" };
    }

    const outputToRecipient = utxos.outputs?.find((out) => out.address === expectedRecipient);

    if (!outputToRecipient) {
      return { valid: false, error: "No output to recipient found" };
    }

    const amount = outputToRecipient.amount?.find((a) => a.unit === "lovelace")?.quantity;
    if (!amount || Number(amount) < expectedAmount) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount}, got ${amount || 0}`,
      };
    }

    return {
      valid: true,
      amount: Number(amount),
      blockTime: tx.block_time,
      blockHeight: tx.block_height,
      explorerLink: getExplorerLink(txHash),
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};

