// worker-server.js - Worker Backend for AgentPact
// Fetches URL, computes hash, submits proof

import express from "express";
import cors from "cors";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";

const app = express();
app.use(cors());
app.use(express.json());

const AGENTPACT_ADDR = process.env.AGENTPACT_ADDR || "0xcb025076A42BeF388f95BE4BE5dD156fA2e627A2";
const PRIVATE_KEY = process.env.WORKER_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("WORKER_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const client = createClient({ chain: studionet, account });

console.log("Worker Backend - Address:", account.address);

app.get("/health", (req, res) => {
  res.json({ status: "ok", worker: account.address });
});

app.post("/submit-proof", async (req, res) => {
  try {
    const { agreementId, proofUrl, nonce } = req.body;
    if (!agreementId || !proofUrl || !nonce) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Fetch URL off-chain and compute hash
    let proofHash;
    try {
      const response = await fetch(proofUrl);
      const content = await response.text();
      proofHash = keccak256(toHex(content));
    } catch (e) {
      proofHash = keccak256(toHex(proofUrl));
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "submit_proof",
      args: [agreementId, proofHash, BigInt(nonce)],
    });

    res.json({ success: true, txHash, proofHash });
  } catch (e) {
    console.error("Submit proof error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/agreement/:id", async (req, res) => {
  try {
    const result = await client.readContract({
      address: AGENTPACT_ADDR,
      functionName: "get_agreement",
      args: [req.params.id],
    });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Worker server running on port ${PORT}`));
