// AgentPact — full end-to-end live test on Bradbury.
// createMarket -> stake YES + NO -> resolve -> settle -> claim
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { Wallet } from "ethers";

const KS = "/home/administrator/.genlayer/keystores/user_wallet.json";
const ADDR = process.env.ADDR || "0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04";
const GLPASS = process.env.GLPASS || "test1234";

const wallet = Wallet.fromEncryptedJsonSync(readFileSync(KS, "utf8"), GLPASS);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

console.log("deployer:", account.address);
console.log("contract:", ADDR);

// Helper: wait for transaction
async function waitTx(hash, label) {
  console.log(`\n--- ${label} ---`);
  console.log("tx:", hash);
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 120, interval: 5000 });
  console.log("status:", receipt?.statusName ?? receipt?.status ?? "unknown");
  return receipt;
}

// Step 1: createMarket
console.log("\n=== STEP 1: createMarket ===");
const createHash = await client.writeContract({
  address: ADDR,
  functionName: "createMarket",
  args: ["TestAgent", "Write a short summary", "https://example.com/deliverable", "Summary must be complete and accurate"],
  gasLimit: 5000000n,
});
const createReceipt = await waitTx(createHash, "createMarket");
const createTx = await client.getTransaction({ hash: createHash });
console.log("result:", createTx?.result ?? createTx?.data ?? "unknown");

// Get the market id from getConfig
const config = await client.readContract({ address: ADDR, functionName: "getConfig", args: [] });
console.log("market_count:", config);
const mid = `market-${config}`;
console.log("market_id:", mid);

// Step 2: stake YES
console.log("\n=== STEP 2: stake YES ===");
const stakeYesHash = await client.writeContract({
  address: ADDR,
  functionName: "stake",
  args: [mid, "YES"],
  value: 1000000000000000000n, // 1 GEN
  gasLimit: 5000000n,
});
await waitTx(stakeYesHash, "stake YES (1 GEN)");

// Step 3: stake NO
console.log("\n=== STEP 3: stake NO ===");
const stakeNoHash = await client.writeContract({
  address: ADDR,
  functionName: "stake",
  args: [mid, "NO"],
  value: 1000000000000000000n, // 1 GEN
  gasLimit: 5000000n,
});
await waitTx(stakeNoHash, "stake NO (1 GEN)");

// Check market state after staking
const marketAfterStake = await client.readContract({ address: ADDR, functionName: "getMarket", args: [mid] });
console.log("market after stake:", JSON.stringify(marketAfterStake));

// Step 4: resolve
console.log("\n=== STEP 4: resolve ===");
const resolveHash = await client.writeContract({
  address: ADDR,
  functionName: "resolve",
  args: [mid],
  gasLimit: 5000000n,
});
await waitTx(resolveHash, "resolve");
const resolveTx = await client.getTransaction({ hash: resolveHash });
console.log("resolve result:", resolveTx?.result ?? resolveTx?.data ?? "unknown");

// Check market state after resolve
const marketAfterResolve = await client.readContract({ address: ADDR, functionName: "getMarket", args: [mid] });
console.log("market after resolve:", JSON.stringify(marketAfterResolve));

// Step 5: settle
console.log("\n=== STEP 5: settle ===");
const settleHash = await client.writeContract({
  address: ADDR,
  functionName: "settle",
  args: [mid],
  gasLimit: 5000000n,
});
await waitTx(settleHash, "settle");

// Check market state after settle
const marketAfterSettle = await client.readContract({ address: ADDR, functionName: "getMarket", args: [mid] });
console.log("market after settle:", JSON.stringify(marketAfterSettle));

// Step 6: claim
console.log("\n=== STEP 6: claim ===");
const claimHash = await client.writeContract({
  address: ADDR,
  functionName: "claim",
  args: [mid],
  gasLimit: 5000000n,
});
await waitTx(claimHash, "claim");
const claimTx = await client.getTransaction({ hash: claimHash });
console.log("claim result:", claimTx?.result ?? claimTx?.data ?? "unknown");

// Final verification
console.log("\n=== FINAL VERIFICATION ===");
const finalMarket = await client.readContract({ address: ADDR, functionName: "getMarket", args: [mid] });
console.log("final market:", JSON.stringify(finalMarket));

const position = await client.readContract({ address: ADDR, functionName: "getPosition", args: [mid, account.address] });
console.log("position:", JSON.stringify(position));

const isClaimed = await client.readContract({ address: ADDR, functionName: "isClaimed", args: [mid, account.address] });
console.log("isClaimed:", isClaimed);

console.log("\n=== E2E TEST COMPLETE ===");
