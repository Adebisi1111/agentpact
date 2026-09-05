// worker-server.js - Worker Backend for AgentPact
// Fetches URL, checks status, measures response time, submits proof

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

    // Fetch URL off-chain and measure response
    let proofHash;
    let statusCode = 200;
    let responseTime = 0;
    
    try {
      const startTime = Date.now();
      const response = await fetch(proofUrl);
      const endTime = Date.now();
      responseTime = endTime - startTime;
      statusCode = response.status;
      const content = await response.text();
      proofHash = keccak256(toHex(content));
    } catch (e) {
      proofHash = keccak256(toHex(proofUrl));
      statusCode = 0;
      responseTime = 0;
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "submit_proof",
      args: [agreementId, proofHash, BigInt(statusCode), BigInt(responseTime), BigInt(nonce)],
    });

    res.json({ success: true, txHash, proofHash, statusCode, responseTime });
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

// Automated scheduler - runs every 60 seconds
async function checkAgreements() {
  console.log("Running automated check...");
  // In production: fetch all active agreements, check deadlines, submit proofs
  // For now, this is a placeholder for the cron job
}

// Run scheduler every 60 seconds
setInterval(checkAgreements, 60000);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Worker server running on port ${PORT}`));
