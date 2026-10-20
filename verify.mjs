// Verify source parity + live reads for AgentPact.
import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { Wallet } from "ethers";

const ADDR = process.env.ADDR || "0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04";
const KS = "/home/administrator/.genlayer/keystores/user_wallet.json";
const wallet = Wallet.fromEncryptedJsonSync(readFileSync(KS, "utf8"), process.env.GLPASS);
const client = createClient({ chain: testnetBradbury, account: createAccount(wallet.privateKey) });

const local = readFileSync(new URL("./contracts/agentpact.py", import.meta.url), "utf8");
const code = await client.getContractCode(ADDR);
const live = typeof code === "string" ? code : String(code);
const h = (s) => createHash("sha256").update(s, "utf8").digest("hex");

console.log("=== source parity ===");
console.log("live bytes :", Buffer.byteLength(live, "utf8"));
console.log("local bytes:", Buffer.byteLength(local, "utf8"));
console.log("live  sha256:", h(live));
console.log("local sha256:", h(local));
console.log("MATCH      :", h(live) === h(local) ? "YES" : "NO");

console.log("\n=== live reads ===");
const config = await client.readContract({ address: ADDR, functionName: "getConfig", args: [] });
console.log("getConfig():", config);
const listed = await client.readContract({ address: ADDR, functionName: "listMarkets", args: [0, 20] });
console.log("listMarkets():", JSON.stringify(listed));
