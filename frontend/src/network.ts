// Network configuration for GenLayer Studio Next
export const GENLAYER_CHAIN_ID = 61997;
export const GENLAYER_CHAIN_ID_HEX = '0x1194D';
export const GENLAYER_RPC_URL = 'https://studio-next.genlayer.com/api';
export const GENLAYER_EXPLORER = 'https://explorer-studio-dev.genlayer.com/';
export const GENLAYER_CURRENCY = { name: 'GEN', symbol: 'GEN', decimals: 18 };

export const GENLAYER_NETWORK = {
  chainId: GENLAYER_CHAIN_ID_HEX,
  chainName: 'GenLayer Studio Next',
  rpcUrls: [GENLAYER_RPC_URL],
  nativeCurrency: GENLAYER_CURRENCY,
  blockExplorerUrls: [GENLAYER_EXPLORER],
};

export const CONTRACT_ADDRESS = '0x9bC45B33FCaa6CEdFE4edA477EB10A4F31Ddee9E';
