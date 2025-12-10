import axios from "axios";

const BLOCKFROST_API_URL =
  process.env.NETWORK === "mainnet"
    ? "https://cardano-mainnet.blockfrost.io/api/v0"
    : "https://cardano-preprod.blockfrost.io/api/v0";

const api = axios.create({
  baseURL: BLOCKFROST_API_URL,
  headers: {
    project_id: process.env.BLOCKFROST_KEY,
  },
});

export const getTransaction = async (txHash) => {
  try {
    const { data } = await api.get(`/txs/${txHash}`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const getTransactionUtxos = async (txHash) => {
  try {
    const { data } = await api.get(`/txs/${txHash}/utxos`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const getScriptUtxos = async (scriptAddress) => {
  try {
    const { data } = await api.get(`/addresses/${scriptAddress}/utxos`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

export const submitTransaction = async (txCbor) => {
  try {
    const { data } = await api.post("/tx/submit", {
      data: txCbor,
    });
    return data;
  } catch (error) {
    throw new Error(`Blockfrost submit failed: ${error.response?.data?.message || error.message}`);
  }
};

export const getExplorerLink = (txHash) => {
  const baseUrl =
    process.env.NETWORK === "mainnet"
      ? "https://cardanoscan.io/transaction"
      : "https://preprod.cardanoscan.io/transaction";
  return `${baseUrl}/${txHash}`;
};

