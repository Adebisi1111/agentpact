// worker-server.js - Worker Backend for AgentPact
// Fetches URL, checks status, measures response time, signs proof, submits

import express from "express";
import cors from "cors";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";

const app = express();
app.use(cors());
app.use(express.json());

const AGENTPACT_ADDR = process.env.AGENTPACT_ADDR || "0xd88Dd9138eC5EFec0A1826Fba756938966Ad45e5";
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

    // Sign the proof with worker private key
    const message = `proof:${agreementId}:${proofHash}:${nonce}`;
    const signature = await account.signMessage({ message });

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "submit_proof",
      args: [agreementId, proofHash, BigInt(statusCode), BigInt(responseTime), BigInt(nonce), signature],
    });

    res.json({ success: true, txHash, proofHash, statusCode, responseTime, signature });
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
  
  try {
    // Get all active agreements (in production, this would query a database)
    // For now, we'll check a list of known agreement IDs
    const agreementIds = global.activeAgreements || [];
    
    for (const agreementId of agreementIds) {
      try {
        const result = await client.readContract({
          address: AGENTPACT_ADDR,
          functionName: "get_agreement",
          args: [agreementId],
        });
        
        if (!result || result.status !== "active") continue;
        
        // Check if due
        const isDue = await client.readContract({
          address: AGENTPACT_ADDR,
          functionName: "is_due",
          args: [agreementId],
        });
        
        if (!isDue) continue;
        
        console.log(`Agreement ${agreementId} is due, submitting proof...`);
        
        // Fetch URL and submit proof
        const startTime = Date.now();
        const response = await fetch(result.terms);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const statusCode = response.status;
        const content = await response.text();
        const proofHash = keccak256(toHex(content));
        
        // Get current nonce
        const nonceResult = await client.readContract({
          address: AGENTPACT_ADDR,
          functionName: "get_nonce",
          args: [agreementId],
        });
        const nonce = Number(nonceResult) + 1;
        
        // Sign proof
        const message = `proof:${agreementId}:${proofHash}:${nonce}`;
        const signature = await account.signMessage({ message });
        
        // Submit proof
        const txHash = await client.writeContract({
          address: AGENTPACT_ADDR,
          functionName: "submit_proof",
          args: [agreementId, proofHash, BigInt(statusCode), BigInt(responseTime), BigInt(nonce), signature],
        });
        
        console.log(`Proof submitted for ${agreementId}: ${txHash}`);
      } catch (e) {
        console.error(`Error checking agreement ${agreementId}:`, e.message);
      }
    }
  } catch (e) {
    console.error("Scheduler error:", e);
  }
}

// Run scheduler every 60 seconds
setInterval(checkAgreements, 60000);

// Track active agreements
app.post("/track-agreement", (req, res) => {
  const { agreementId } = req.body;
  if (!global.activeAgreements) global.activeAgreements = [];
  if (!global.activeAgreements.includes(agreementId)) {
    global.activeAgreements.push(agreementId);
  }
  res.json({ success: true, tracking: global.activeAgreements });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Worker server running on port ${PORT}`));
