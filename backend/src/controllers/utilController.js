import {
  getTransaction,
  getTransactionUtxos,
  getScriptUtxos,
  getExplorerLink,
} from '../services/blockfrost.js';

export const getTxStatus = async (req, res, next) => {
  try {
    const { txHash } = req.params;
    // Support a debug mode to return raw Blockfrost responses and errors
    const debugMode = req.query.debug === '1' || req.query.debug === 'true';

    let tx = null;
    let utxos = null;
    const errors = {};

    try {
      tx = await getTransaction(txHash);
    } catch (e) {
      errors.tx = { message: e.message, name: e.name };
    }

    try {
      utxos = await getTransactionUtxos(txHash);
    } catch (e) {
      errors.utxos = { message: e.message, name: e.name };
    }

    if (!tx) {
      const explorerLink = getExplorerLink(txHash);
      const status = errors.tx?.message?.includes('not found') ? 'NOT_FOUND' : 'UNKNOWN';

      const payload = {
        txHash,
        status,
        explorerLink,
      };

      if (debugMode) {
        payload.raw = { tx: tx || null, utxos: utxos || null };
        payload.errors = errors;
      }

      return res.status(404).json(payload);
    }

    const status = tx.block === null ? 'PENDING' : 'CONFIRMED';
    const explorerLink = getExplorerLink(txHash);

    const response = {
      txHash,
      status,
      blockTime: tx.block_time || null,
      blockHeight: tx.block_height || null,
      explorerLink,
    };

    if (debugMode) {
      response.raw = { tx, utxos };
      if (Object.keys(errors).length) response.errors = errors;
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const getScriptUtxosList = async (req, res, next) => {
  try {
    const { address } = req.params;
    const utxos = await getScriptUtxos(address);

    res.json({
      address,
      utxos: utxos.map((utxo) => ({
        txHash: utxo.tx_hash,
        outputIndex: utxo.output_index,
        amount: utxo.amount,
        datum: utxo.inline_datum || utxo.data_hash,
      })),
    });
  } catch (error) {
    next(error);
  }
};
