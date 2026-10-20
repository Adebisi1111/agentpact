import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { readFileSync } from "fs";
import { Wallet } from "ethers";

const KS = "/home/administrator/.genlayer/keystores/user_wallet.json";
const wallet = Wallet.fromEncryptedJsonSync(readFileSync(KS, "utf8"), "test1234");
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: testnetBradbury, account });

console.log("deployer:", account.address);

const config = await client.readContract({ 
  address: "0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04", 
  functionName: "getConfig", 
  args: [] 
});
console.log("getConfig:", config);

const listed = await client.readContract({ 
  address: "0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04", 
  functionName: "listMarkets", 
  args: [0, 20] 
});
console.log("listMarkets:", JSON.stringify(listed));
