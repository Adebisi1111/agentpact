// scripts/fund-worker.mjs
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http } from "viem";
import { testnetBradbury } from "genlayer-js/chains";

const PRIVATE_KEY = "0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af";
const WORKER_ADDRESS = "0x97d031212275ef6b442CF206779d690f45913330";

const account = privateKeyToAccount(PRIVATE_KEY);

const client = createWalletClient({
  account,
  chain: testnetBradbury,
  transport: http("https://rpc-bradbury.genlayer.com"),
});

const txHash = await client.sendTransaction({
  to: WORKER_ADDRESS,
  value: 10000000000000000000n, // 10 GEN
});

console.log("Tx Hash:", txHash);
