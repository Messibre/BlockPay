import { getTransaction, getTransactionUtxos, getExplorerLink } from './blockfrost.js';

/**
 * Verify that a transaction sent funds to a contract address with correct amount
 */
export const verifyDeposit = async (txHash, contractAddress, expectedAmount) => {
  try {
    const tx = await getTransaction(txHash);
    if (!tx) {
      return {
        valid: false,
        error: 'Transaction not found',
        status: 'PENDING',
        explorerLink: getExplorerLink(txHash),
      };
    }

    if (tx.block === null) {
      return { valid: false, error: 'Transaction not confirmed', status: 'PENDING' };
    }

    const utxos = await getTransactionUtxos(txHash);
    if (!utxos) {
      return { valid: false, error: 'UTxOs not found', explorerLink: getExplorerLink(txHash) };
    }

    // Check outputs for contract address
    let outputToContract = utxos.outputs?.find((out) => out.address === contractAddress);

    // Fallback: some wallets submit to the script address but blockfrost may return inline datum
    // or a different address; try to find any output that looks like a script output (has inline_datum or data_hash)
    if (!outputToContract) {
      outputToContract = utxos.outputs?.find((out) => out.inline_datum || out.data_hash);
    }

    if (!outputToContract) {
      // Provide the full outputs for diagnostics
      return {
        valid: false,
        error: 'No output to contract address or script datum found',
        outputs: utxos.outputs,
        explorerLink: getExplorerLink(txHash),
      };
    }

    const amount = outputToContract.amount?.find((a) => a.unit === 'lovelace')?.quantity;
    if (!amount || Number(amount) < expectedAmount) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount}, got ${amount || 0}`,
        amountFound: Number(amount) || 0,
        outputs: utxos.outputs,
        explorerLink: getExplorerLink(txHash),
      };
    }

    return {
      valid: true,
      amount: Number(amount),
      matchedAddress: outputToContract.address || null,
      hasInlineDatum: !!outputToContract.inline_datum || !!outputToContract.data_hash,
      blockTime: tx.block_time,
      blockHeight: tx.block_height,
      explorerLink: getExplorerLink(txHash),
    };
  } catch (error) {
    // If Blockfrost returned a not-found diagnostic (404), consider the
    // transaction as PENDING (recently submitted, not yet indexed) so the
    // caller can accept it and retry verification later.
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('not found') || msg.includes('404')) {
      return {
        valid: false,
        error: 'Transaction not found',
        status: 'PENDING',
        explorerLink: getExplorerLink(txHash),
      };
    }

    // Surface other errors normally
    return { valid: false, error: error.message, explorerLink: getExplorerLink(txHash) };
  }
};

/**
 * Verify a payout transaction
 */
export const verifyPayout = async (
  txHash,
  expectedRecipient,
  expectedAmount,
  expectedFeeRecipient = null,
  expectedFeeAmount = 0,
) => {
  try {
    const tx = await getTransaction(txHash);
    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    if (tx.block === null) {
      return { valid: false, error: 'Transaction not confirmed', status: 'PENDING' };
    }

    const utxos = await getTransactionUtxos(txHash);
    if (!utxos) {
      return { valid: false, error: 'UTxOs not found' };
    }

    const outputToRecipient = utxos.outputs?.find((out) => out.address === expectedRecipient);
    if (!outputToRecipient) {
      return { valid: false, error: 'No output to recipient found' };
    }

    const amount = outputToRecipient.amount?.find((a) => a.unit === 'lovelace')?.quantity;
    if (!amount || Number(amount) < expectedAmount) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount}, got ${amount || 0}`,
      };
    }

    // If a platform fee recipient is expected, verify that output exists and has the expected amount
    if (expectedFeeRecipient) {
      const feeOutput = utxos.outputs?.find((out) => out.address === expectedFeeRecipient);
      if (!feeOutput) {
        return { valid: false, error: 'No output to platform fee recipient found' };
      }
      const feeAmount = feeOutput.amount?.find((a) => a.unit === 'lovelace')?.quantity;
      if (!feeAmount || Number(feeAmount) < expectedFeeAmount) {
        return {
          valid: false,
          error: `Fee amount mismatch: expected ${expectedFeeAmount}, got ${feeAmount || 0}`,
        };
      }
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
