const { createClient, chains } = require('genlayer-js');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

const studioNext = {
  ...chains.studionet,
  id: 61997,
  name: 'Studio Next',
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
};

const account = privateKeyToAccount('0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af');
const client = createClient({ chain: studioNext, account });

async function deploy() {
  const code = fs.readFileSync('contracts/agentpact_v11.py');
  console.log('Deploying with higher fee value...');
  const hash = await client.deployContract({
    code: new Uint8Array(code),
    args: [],
    value: 0n,
    gasLimit: 5000000n,
    fees: {
      distribution: {
        leaderTimeunitsAllocation: 125n,
        validatorTimeunitsAllocation: 250n,
        rotations: [0n],
      },
      feeValue: 100000000000000000n, // 0.1 GEN
      executionBudgetPerRound: 25000000000000000n,
    },
  });
  console.log('Hash:', hash);
  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: 'finalized', retries: 300 });
  console.log('Deployed at:', receipt.data?.contractAddress || receipt.txDataDecoded?.contractAddress);
}

deploy().catch(e => console.error(e.message));
