const { createClient, chains } = require('genlayer-js');
const { privateKeyToAccount } = require('viem/accounts');

const CONTRACT = '0xf3bb0D88A3D07C7A349f30292c9ff470b2990652';
const PRIVATE_KEY = '0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af';

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const client = createClient({ chain: chains.testnetBradbury, account });

  console.log('Account:', account.address);

  // Report violation
  console.log('\n--- Report Violation ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'report_violation',
      args: ['test-v5'],
    });
    console.log('Violation tx:', tx);
  } catch (err) {
    console.error('Violation error:', err.message);
  }

  await new Promise(r => setTimeout(r, 15000));

  // Read state
  console.log('\n--- State After Violation ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v5'],
    });
    console.log('Status:', result.status);
    console.log('Violations:', result.violations);
    console.log('Consecutive failures:', result.consecutive_failures);
    console.log('Total penalties:', result.total_penalties);
  } catch (err) {
    console.error('Read error:', err.message);
  }

  // Cancel
  console.log('\n--- Cancel Agreement ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'cancel_agreement',
      args: ['test-v5'],
    });
    console.log('Cancel tx:', tx);
  } catch (err) {
    console.error('Cancel error:', err.message);
  }

  await new Promise(r => setTimeout(r, 15000));

  // Final state
  console.log('\n--- Final State ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v5'],
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
