import { getTransaction, getScriptUtxos, getExplorerLink } from "../services/blockfrost.js";

export const getTxStatus = async (req, res, next) => {
  try {
    const { txHash } = req.params;
    const tx = await getTransaction(txHash);

    if (!tx) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const status = tx.block === null ? "PENDING" : "CONFIRMED";
    const explorerLink = getExplorerLink(txHash);

    res.json({
      txHash,
      status,
      blockTime: tx.block_time || null,
      blockHeight: tx.block_height || null,
      explorerLink,
    });
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

