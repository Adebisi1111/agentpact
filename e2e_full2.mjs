import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { Wallet } from "ethers";

const KS = "/home/administrator/.genlayer/keystores/user_wallet.json";
const wallet = Wallet.fromEncryptedJsonSync(readFileSync(KS, "utf8"), process.env.GLPASS);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });
const CONTRACT = "0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04";

async function waitState(checkFn, label, maxWait = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 10000));
    const result = await checkFn();
    if (result) {
      console.log(`  ${label}: done after ${Math.round((Date.now()-start)/1000)}s`);
      return result;
    }
    console.log(`  ${label}: waiting... (${Math.round((Date.now()-start)/1000)}s)`);
  }
  console.log(`  ${label}: timeout after ${maxWait/1000}s`);
  return null;
}

console.log("=== E2E TEST ===");

// 1. Create market
console.log("\n1. createMarket");
const h1 = await client.writeContract({
  address: CONTRACT, functionName: "createMarket",
  args: ["E2ETestAgent2", "Write a haiku", "https://example.com/deliverable", "Must be 3 lines"],
  value: 0n,
});
console.log("  tx:", h1);
const mcBefore = (await client.readContract({ address: CONTRACT, functionName: "getConfig", args: [] }));
console.log("  market count before wait:", mcBefore);
await waitState(async () => {
  const c = await client.readContract({ address: CONTRACT, functionName: "getConfig", args: [] });
  return c > mcBefore ? c : null;
}, "createMarket", 90000);
const mcAfter = await client.readContract({ address: CONTRACT, functionName: "getConfig", args: [] });
const marketId = `market-${mcAfter}`;
console.log("  new market:", marketId);

// 2. Stake YES
console.log("\n2. stake YES");
const mBefore = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [marketId] });
console.log("  pool before:", mBefore.pool);
const h2 = await client.writeContract({
  address: CONTRACT, functionName: "stake", args: [marketId, "YES"], value: 1000000000000000000n,
});
console.log("  tx:", h2);
await waitState(async () => {
  const m = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [marketId] });
  return (m.pool !== '0' && m.pool !== 0n) ? m : null;
}, "stake", 90000);
const mAfter = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [marketId] });
console.log("  pool after:", mAfter.pool);

// 3. Resolve
console.log("\n3. resolve");
const h3 = await client.writeContract({
  address: CONTRACT, functionName: "resolve", args: [marketId], value: 0n,
});
console.log("  tx:", h3);
await waitState(async () => {
  const m = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [marketId] });
  return m.status !== "OPEN" ? m : null;
}, "resolve", 120000);
const mResolved = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [marketId] });
console.log("  status:", mResolved.status, "outcome:", mResolved.outcome);

// 4. Settle (if resolved)
if (mResolved.status === "RESOLVED") {
  console.log("\n4. settle");
  const h4 = await client.writeContract({
    address: CONTRACT, functionName: "settle", args: [marketId], value: 0n,
  });
  console.log("  tx:", h4);
  await waitState(async () => {
    const m = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [marketId] });
    return m.status === "SETTLED" ? m : null;
  }, "settle", 90000);
  const mSettled = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [marketId] });
  console.log("  status:", mSettled.status);
}

// 5. Claim
console.log("\n5. claim");
const h5 = await client.writeContract({
  address: CONTRACT, functionName: "claim", args: [marketId], value: 0n,
});
console.log("  tx:", h5);
await new Promise(r => setTimeout(r, 30000));
console.log("  claim submitted");

console.log("\n=== E2E COMPLETE ===");
