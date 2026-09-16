/**
 * AgentPact v5 Integration Test — GenLayer Studio Next
 * 
 * Uses raw eth_call to avoid viem ABI decoding issues with GenLayer's
 * non-standard tuple/dict return encoding.
 * 
 * Run: node tests/integration-studio-next.mjs
 */

import * as gl from 'genlayer-js';

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af';
const CONTRACT = '0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063';
const AGREEMENT_ID = 'TEST-' + Date.now();

const studioNext = {
  ...gl.chains.studionet,
  id: 61997,
  name: 'Studio Next',
  rpcUrls: { default: { http: ['https://studio-next.genlayer.com/api'] } },
};

const account = gl.createAccount(PRIVATE_KEY);
const client = gl.createClient({ chain: studioNext, account });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function waitForReceipt(txHash, timeout = 300) {
  return await client.waitForTransactionReceipt({
    hash: txHash,
    waitUntil: 'finalized',
    retries: timeout,
  });
}

// Manual ABI encoding for view functions (avoids viem decode issues)
function encodeCall(fn, args) {
  const sigs = {
    'get_stats': '0x61837e41',
    'get_agreement': '0xff6f0fee',
  };
  return sigs[fn] || '0x';
}

async function readView(fn, args) {
  const data = encodeCall(fn, args);
  const result = await client.call({
    to: CONTRACT,
    data,
  });
  return result;
}

async function runTest() {
  log('Starting AgentPact v5 Integration Test');
  log(`Account: ${account.address}`);
  log(`Contract: ${CONTRACT}`);
  log(`Agreement ID: ${AGREEMENT_ID}`);

  // Step 1: Create agreement
  log('\n--- Step 1: Create Agreement ---');
  const createTx = await client.writeContract({
    address: CONTRACT,
    functionName: 'create_agreement',
    args: [
      AGREEMENT_ID,
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      'https://example.com',
      1000n,
      3600n,
      5n,
      90n,
      2000n,
      10n,
    ],
    value: 0n,
  });
  log(`Create TX: ${createTx}`);
  const createReceipt = await waitForReceipt(createTx);
  log(`Create receipt status: ${createReceipt.statusName}`);
  log(`Create txExecutionResultName: ${createReceipt.txExecutionResultName}`);

  if (createReceipt.txExecutionResultName !== 'FINISHED_WITH_RETURN') {
    throw new Error(`Create failed: ${createReceipt.txExecutionResultName}`);
  }

  // Step 2: Fund agreement
  log('\n--- Step 2: Fund Agreement ---');
  const fundTx = await client.writeContract({
    address: CONTRACT,
    functionName: 'fund_agreement',
    args: [AGREEMENT_ID],
    value: 5000n,
  });
  log(`Fund TX: ${fundTx}`);
  const fundReceipt = await waitForReceipt(fundTx);
  log(`Fund receipt status: ${fundReceipt.statusName}`);
  log(`Fund txExecutionResultName: ${fundReceipt.txExecutionResultName}`);

  // Step 3: Submit proof (validators verify the service URL)
  log('\n--- Step 3: Submit Proof (Validators Verify) ---');
  log('Validators will fetch https://example.com and compute SHA-256...');
  
  const proofTx = await client.writeContract({
    address: CONTRACT,
    functionName: 'submit_proof',
    args: [AGREEMENT_ID],
    value: 0n,
  });
  log(`Proof TX: ${proofTx}`);
  const proofReceipt = await waitForReceipt(proofTx);
  log(`Proof receipt status: ${proofReceipt.statusName}`);
  log(`Proof txExecutionResultName: ${proofReceipt.txExecutionResultName}`);

  // Step 4: Read final stats via raw eth_call
  log('\n--- Step 4: Read Final Stats ---');
  const statsData = await readView('get_stats', []);
  const h = statsData.slice(2); // remove 0x
  const totalAgreements = parseInt(h.slice(0, 64), 16);
  const totalProofs = parseInt(h.slice(64, 128), 16);
  log(`Total agreements: ${totalAgreements}`);
  log(`Total proofs: ${totalProofs}`);

  // Summary
  log('\n=== TEST SUMMARY ===');
  log(`Create: ${createReceipt.txExecutionResultName}`);
  log(`Fund: ${fundReceipt.txExecutionResultName}`);
  log(`Proof: ${proofReceipt.txExecutionResultName}`);
  log(`Total agreements: ${totalAgreements}`);
  log(`Total proofs: ${totalProofs}`);
  
  if (proofReceipt.txExecutionResultName === 'FINISHED_WITH_RETURN') {
    log('✅ TEST PASSED: Validator-verified proof works!');
  } else {
    log('❌ TEST FAILED: Proof did not complete successfully');
  }
}

runTest().catch((err) => {
  console.error('Test failed with error:', err.message);
  process.exit(1);
});
