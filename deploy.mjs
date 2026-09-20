import { createClient } from 'genlayer-js';
import { privateKeyToAccount } from 'viem/accounts';
import fs from 'fs';

const studioNext = {
  id: 61997,
  name: 'Studio Next',
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
  testnet: true,
  consensusMainContract: {
    address: '0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D',
    abi: [],
  },
  defaultNumberOfInitialValidators: 5,
  defaultConsensusMaxRotations: 3,
};

const account = privateKeyToAccount('0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af');
const client = createClient({ chain: studioNext, account });

const code = fs.readFileSync('contracts/agentpact_v11.py');
console.log('Deploying to Studio Next (61997)...');

try {
  const hash = await client.deployContract({
    code: new Uint8Array(code),
    args: [],
    value: 0n,
    gasLimit: 5000000n,
  });
  console.log('Hash:', hash);
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: 'finalized', retries: 300 });
  const addr = receipt.data?.contractAddress || receipt.txDataDecoded?.contractAddress;
  console.log('Deployed at:', addr);
} catch (e) {
  console.error('Error:', e.message);
}
