import axios from 'axios';

// Build Blockfrost base URL at call time so `NETWORK` may be set via dotenv before use
const getBaseUrl = () =>
  process.env.NETWORK === 'mainnet'
    ? 'https://cardano-mainnet.blockfrost.io/api/v0'
    : 'https://cardano-preprod.blockfrost.io/api/v0';

// Create Axios instance lazily to ensure env vars are loaded (dotenv may run after module import)
const getApi = () => {
  const key = process.env.BLOCKFROST_KEY;
  if (!key) {
    throw new Error(
      'BLOCKFROST_KEY environment variable is not set. Set BLOCKFROST_KEY to your Blockfrost project id.',
    );
  }
  return axios.create({
    baseURL: getBaseUrl(),
    headers: {
      project_id: key,
    },
  });
};

export const getTransaction = async (txHash) => {
  try {
    const { data } = await getApi().get(`/txs/${txHash}`);
    return data;
  } catch (error) {
    // If Blockfrost returns 404, include helpful diagnostic info so callers
    // can surface which network / base URL was used when the tx wasn't found.
    if (error.response?.status === 404) {
      const base = getBaseUrl();
      const msg = `Transaction ${txHash} not found (404) at ${base} (NETWORK=${process.env.NETWORK})`;
      // Include response body in debug log if present
      console.warn('Blockfrost 404:', { txHash, base, response: error.response?.data });
      throw new Error(msg);
    }
    // Map 403 to a clearer message
    if (error.response?.status === 403) {
      throw new Error(
        'Blockfrost access forbidden (403). Check BLOCKFROST_KEY and project permissions.',
      );
    }
    throw error;
  }
};

export const getTransactionUtxos = async (txHash) => {
  try {
    const { data } = await getApi().get(`/txs/${txHash}/utxos`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      const base = getBaseUrl();
      const msg = `UTxOs for ${txHash} not found (404) at ${base} (NETWORK=${process.env.NETWORK})`;
      console.warn('Blockfrost 404:', { txHash, base, response: error.response?.data });
      throw new Error(msg);
    }
    if (error.response?.status === 403) {
      throw new Error(
        'Blockfrost access forbidden (403). Check BLOCKFROST_KEY and project permissions.',
      );
    }
    throw error;
  }
};

export const getScriptUtxos = async (scriptAddress) => {
  try {
    const { data } = await getApi().get(`/addresses/${scriptAddress}/utxos`);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      return [];
    }
    if (error.response?.status === 403) {
      throw new Error(
        'Blockfrost access forbidden (403). Check BLOCKFROST_KEY and project permissions.',
      );
    }
    throw error;
  }
};

export const submitTransaction = async (txCbor) => {
  try {
    // Blockfrost expects the raw CBOR bytes as the request body with Content-Type: application/cbor
    // If a hex string is provided, send it as raw bytes
    const body = typeof txCbor === 'string' ? Buffer.from(txCbor, 'hex') : txCbor;
    const { data } = await getApi().post('/tx/submit', body, {
      headers: { 'Content-Type': 'application/cbor' },
    });
    return data;
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error(
        'Blockfrost submit failed: access forbidden (403). Check BLOCKFROST_KEY and project permissions.',
      );
    }
    const bfMsg = error.response?.data?.message || error.message;
    throw new Error(`Blockfrost submit failed: ${bfMsg}`);
  }
};

// Ping the Blockfrost API to check availability and permissions
export const ping = async () => {
  try {
    const { data } = await getApi().get('/health');
    return { ok: true, data };
  } catch (error) {
    if (error.response?.status === 403) {
      return {
        ok: false,
        error: 'Blockfrost access forbidden (403). Check BLOCKFROST_KEY and project permissions.',
      };
    }
    return { ok: false, error: error.message };
  }
};

export const getExplorerLink = (txHash) => {
  const baseUrl =
    process.env.NETWORK === 'mainnet'
      ? 'https://cardanoscan.io/transaction'
      : 'https://preprod.cardanoscan.io/transaction';
  return `${baseUrl}/${txHash}`;
};
