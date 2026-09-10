const { createClient, chains } = require('genlayer-js');
const { privateKeyToAccount } = require('viem/accounts');

const CONTRACT = '0x46cd0D24F8D19378b314683a1078a50a85E7cbA0';
const PRIVATE_KEY = '0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af';

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const client = createClient({ chain: chains.testnetBradbury, account });

  console.log('Account:', account.address);

  // Step 1: Submit proof (worker says service is up)
  console.log('\n--- Step 1: Submit Proof ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'submit_proof',
      args: ['test-v4-2', 'proof_hash_abc123', 2500n],
    });
    console.log('Transaction hash:', tx);
  } catch (err) {
    console.error('Submit error:', err.message);
  }

  // Wait
  console.log('\nWaiting 15 seconds...');
  await new Promise(r => setTimeout(r, 15000));

  // Read state
  console.log('\n--- State After Proof ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v4-2'],
    });
    console.log('Status:', result.status);
    console.log('Paid ticks:', result.paid_ticks);
    console.log('Total paid out:', result.total_paid_out);
    console.log('Last check:', result.last_check_status);
  } catch (err) {
    console.error('Read error:', err.message);
  }

  // Step 2: Report violation
  console.log('\n--- Step 2: Report Violation ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'report_violation',
      args: ['test-v4-2'],
    });
    console.log('Transaction hash:', tx);
  } catch (err) {
    console.error('Violation error:', err.message);
  }

  // Wait
  console.log('\nWaiting 15 seconds...');
  await new Promise(r => setTimeout(r, 15000));

  // Read state
  console.log('\n--- State After Violation ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v4-2'],
    });
    console.log('Status:', result.status);
    console.log('Violations:', result.violations);
    console.log('Consecutive failures:', result.consecutive_failures);
    console.log('Total penalties:', result.total_penalties);
  } catch (err) {
    console.error('Read error:', err.message);
  }

  // Step 3: Cancel agreement
  console.log('\n--- Step 3: Cancel Agreement ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'cancel_agreement',
      args: ['test-v4-2'],
    });
    console.log('Transaction hash:', tx);
  } catch (err) {
    console.error('Cancel error:', err.message);
  }

  // Wait
  console.log('\nWaiting 15 seconds...');
  await new Promise(r => setTimeout(r, 15000));

  // Final state
  console.log('\n--- Final State ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v4-2'],
    });
    console.log('Status:', result.status);
    console.log('Total refunded:', result.total_refunded);
  } catch (err) {
    console.error('Read error:', err.message);
  }

  // Stats
  console.log('\n--- Final Stats ---');
  try {
    const stats = await client.readContract({
      address: CONTRACT,
      functionName: 'get_stats',
      args: [],
    });
    console.log('Stats:', stats);
  } catch (err) {
    console.error('Stats error:', err.message);
  }
}

main().catch(console.error);
