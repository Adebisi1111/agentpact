const { createClient, chains } = require('genlayer-js');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

const account = privateKeyToAccount('0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af');

// Studio Next custom chain
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
};

const client = createClient({ chain: studioNext, account });

async function deploy() {
  const code = fs.readFileSync('contracts/agentpact_v11.py');
  console.log('Deploying to Studio Next (61997)...');
  const hash = await client.deployContract({
    code: new Uint8Array(code),
    args: [],
    value: 0n,
    gasLimit: 5000000n,
    fees: {
      distribution: {
        leaderTimeunitsAllocation: 100n,
        validatorTimeunitsAllocation: 200n,
        rotations: [0n],
      },
      feeValue: 94642800002588n,
      executionBudgetPerRound: 94642800000000n,
      totalMessageFees: 0n,
    },
  });
  console.log('Hash:', hash);
}

deploy().catch(e => console.error(e.message));
