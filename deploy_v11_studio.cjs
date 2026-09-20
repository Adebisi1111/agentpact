const { createClient } = require('genlayer-js');
const { privateKeyToAccount } = require('viem/accounts');
const fs = require('fs');

// Studio Next custom chain config
const studioNext = {
  id: 61997,
  name: 'Studio Next',
  rpcUrls: {
    default: {
      http: ['https://studio-next.genlayer.com/api'],
    },
  },
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  testnet: true,
};

const pk = '0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af';
const account = privateKeyToAccount(pk);

const client = createClient({
  chain: studioNext,
  account,
});

async function deploy() {
  const code = fs.readFileSync('contracts/agentpact_v11.py');

  console.log('Deploying AgentPact v11 to Studio Next (61997)...');
  const hash = await client.deployContract({
    code: new Uint8Array(code),
    args: [],
    value: 0n,
    gasLimit: 5000000n,
  });
  console.log('Deploy hash:', hash);

  const receipt = await client.waitForTransactionReceipt({ hash, waitUntil: 'finalized', retries: 300 });
  const addr = receipt.data?.contractAddress || receipt.txDataDecoded?.contractAddress;
  console.log('Deployed at:', addr);
  return addr;
}

deploy().catch(e => console.error(e.message));
