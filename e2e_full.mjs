import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { Wallet } from "ethers";

const KS = "/home/administrator/.genlayer/keystores/user_wallet.json";
const wallet = Wallet.fromEncryptedJsonSync(readFileSync(KS, "utf8"), process.env.GLPASS);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

const CONTRACT = "0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04";

async function waitTx(hash, label) {
  console.log(`  waiting for ${label}...`);
  const receipt = await client.waitForTransactionReceipt({ hash, retries: 120, interval: 5000 });
  console.log(`  ${label}: ${receipt?.statusName ?? receipt?.status ?? "unknown"}`);
  return receipt;
}

console.log("=== E2E TEST ===");
console.log("deployer:", account.address);

// 1. Create market
console.log("\n1. createMarket");
const h1 = await client.writeContract({
  address: CONTRACT,
  functionName: "createMarket",
  args: ["E2ETestAgent", "Write a haiku about blockchain", "https://example.com/deliverable", "Must be exactly 3 lines"],
  value: 0n,
});
console.log("  tx:", h1);
await waitTx(h1, "createMarket");

// 2. Check markets
console.log("\n2. listMarkets");
const markets = await client.readContract({ address: CONTRACT, functionName: "listMarkets", args: [0n, 10n] });
console.log("  total:", markets.total);
const lastMarket = markets.markets[markets.markets.length - 1];
console.log("  last market:", lastMarket.market_id, lastMarket.status);

// 3. Stake YES
console.log("\n3. stake YES");
const h2 = await client.writeContract({
  address: CONTRACT,
  functionName: "stake",
  args: [lastMarket.market_id, "YES"],
  value: 1000000000000000000n, // 1 GEN
});
console.log("  tx:", h2);
await waitTx(h2, "stake");

// 4. Resolve
console.log("\n4. resolve");
const h3 = await client.writeContract({
  address: CONTRACT,
  functionName: "resolve",
  args: [lastMarket.market_id],
  value: 0n,
});
console.log("  tx:", h3);
await waitTx(h3, "resolve");

// 5. Check market status
console.log("\n5. check market");
const m = await client.readContract({ address: CONTRACT, functionName: "getMarket", args: [lastMarket.market_id] });
console.log("  status:", m.status, "outcome:", m.outcome);

// 6. Settle (if resolved)
if (m.status === "RESOLVED") {
  console.log("\n6. settle");
  const h4 = await client.writeContract({
    address: CONTRACT,
    functionName: "settle",
    args: [lastMarket.market_id],
    value: 0n,
  });
  console.log("  tx:", h4);
  await waitTx(h4, "settle");
}

// 7. Claim
console.log("\n7. claim");
const h5 = await client.writeContract({
  address: CONTRACT,
  functionName: "claim",
  args: [lastMarket.market_id],
  value: 0n,
});
console.log("  tx:", h5);
await waitTx(h5, "claim");

console.log("\n=== E2E COMPLETE ===");
