const { createClient, chains } = require('genlayer-js');
const { privateKeyToAccount } = require('viem/accounts');

const CONTRACT = '0xf3bb0D88A3D07C7A349f30292c9ff470b2990652';
const PRIVATE_KEY = '0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af';

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const client = createClient({ chain: chains.testnetBradbury, account });

  console.log('Account:', account.address);

  // Create
  console.log('\n--- Create ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'create_agreement',
      args: ['test-v5', '0x782abaE1C6C4aec093C964785a4c10C0991Fa01A', 'Test service', 10000000000000000n, 3600, 10, 95, 5000, 10],
    });
    console.log('Create tx:', tx);
  } catch (err) {
    console.error('Create error:', err.message);
    return;
  }

  await new Promise(r => setTimeout(r, 15000));

  // Fund
  console.log('\n--- Fund ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'fund_agreement',
      args: ['test-v5'],
      value: 100000000000000000n,
    });
    console.log('Fund tx:', tx);
  } catch (err) {
    console.error('Fund error:', err.message);
  }

  await new Promise(r => setTimeout(r, 15000));

  // Submit proof
  console.log('\n--- Submit Proof ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'submit_proof',
      args: ['test-v5', 'proof_hash_123', 2500n],
    });
    console.log('Submit tx:', tx);
  } catch (err) {
    console.error('Submit error:', err.message);
  }

  await new Promise(r => setTimeout(r, 15000));

  // Read state
  console.log('\n--- Final State ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v5'],
    });
    console.log('Status:', result.status);
    console.log('Paid ticks:', result.paid_ticks);
    console.log('Total paid out:', result.total_paid_out);
    console.log('Last check:', result.last_check_status);
  } catch (err) {
    console.error('Read error:', err.message);
  }
}

main().catch(console.error);
