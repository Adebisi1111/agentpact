const { createClient, chains } = require('genlayer-js');
const { privateKeyToAccount } = require('viem/accounts');

const CONTRACT = '0x46cd0D24F8D19378b314683a1078a50a85E7cbA0';
const PRIVATE_KEY = '0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af';

async function main() {
  const account = privateKeyToAccount(PRIVATE_KEY);
  const client = createClient({ chain: chains.testnetBradbury, account });

  console.log('Account:', account.address);
  console.log('Contract:', CONTRACT);

  // Step 1: Create agreement (no value)
  console.log('\n--- Step 1: Create Agreement ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'create_agreement',
      args: [
        'test-v4-2',
        '0x782abaE1C6C4aec093C964785a4c10C0991Fa01A',
        'Test service agreement v4',
        10000000000000000n,  // payment_per_tick: 0.01 GEN
        3600,                // interval_seconds
        10,                  // total_ticks
        95,                  // uptime_required
        5000,                // response_time_required
        10                   // penalty_rate
      ],
    });
    console.log('Transaction hash:', tx);
  } catch (err) {
    console.error('Create error:', err.message);
    return;
  }

  // Wait for finalization
  console.log('\nWaiting 15 seconds for finalization...');
  await new Promise(r => setTimeout(r, 15000));

  // Read agreement
  console.log('\n--- Read Agreement ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v4-2'],
    });
    console.log('Result:', result);
  } catch (err) {
    console.error('Read error:', err.message);
  }

  // Step 2: Fund agreement
  console.log('\n--- Step 2: Fund Agreement ---');
  try {
    const tx = await client.writeContract({
      address: CONTRACT,
      functionName: 'fund_agreement',
      args: ['test-v4-2'],
      value: 100000000000000000n,  // 0.1 GEN
    });
    console.log('Transaction hash:', tx);
  } catch (err) {
    console.error('Fund error:', err.message);
  }

  // Wait
  console.log('\nWaiting 15 seconds...');
  await new Promise(r => setTimeout(r, 15000));

  // Read final state
  console.log('\n--- Final State ---');
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName: 'get_agreement',
      args: ['test-v4-2'],
    });
    console.log('Result:', result);
  } catch (err) {
    console.error('Read error:', err.message);
  }

  // Stats
  console.log('\n--- Stats ---');
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
