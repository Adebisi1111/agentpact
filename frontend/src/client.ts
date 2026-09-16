import { createClient, chains } from 'genlayer-js';
import { CONTRACT_ADDRESS } from './network';

// Use the built-in studioDevnet chain definition (chain 61997)
const chain = chains.studioDevnet;

export function createGenlayerClient(account?: string) {
  return createClient({
    chain,
    ...(account ? { account: account as `0x${string}` } : {}),
  });
}

export { CONTRACT_ADDRESS, chain as genlayerChain };
