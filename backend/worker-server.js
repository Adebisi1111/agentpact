// worker-server.js - Worker Backend for AgentPact
// Fetches URL, computes hash, signs it, submits proof

import express from "express";
import cors from "cors";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Configuration ──────────────────────────────────────────────
const AGENTPACT_ADDR = process.env.AGENTPACT_ADDR || "0xF4796C3Ef4288B29be683cD5bE218783D25D55d1";
const PRIVATE_KEY = process.env.WORKER_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("WORKER_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// ─── GenLayer Client (signs with worker private key) ────────────
const account = privateKeyToAccount(PRIVATE_KEY);

const client = createClient({
  chain: testnetBradbury,
  account,
});

console.log("AgentPact Worker Backend");
console.log("Worker Address:", account.address);
console.log("Contract:", AGENTPACT_ADDR);

// ─── Routes ─────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", worker: account.address });
});

// Submit proof - fetches URL, hashes, signs, submits
app.post("/submit-proof", async (req, res) => {
  try {
    const { agreementId, proofUrl, nonce } = req.body;

    if (!agreementId || !proofUrl || !nonce) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Step 1: Fetch the URL off-chain
    let proofHash;
    try {
      const response = await fetch(proofUrl);
      const content = await response.text();
      proofHash = keccak256(toHex(content));
    } catch (e) {
      // If fetch fails, use hash of URL as proof
      proofHash = keccak256(toHex(proofUrl));
    }

    // Step 2: Sign the hash with worker private key
    const signature = await account.signMessage({ message: proofHash });

    // Step 3: Submit to contract
    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "submit_proof",
      args: [agreementId, proofHash, signature, BigInt(nonce)],
    });

    res.json({ success: true, txHash, proofHash, signature });
  } catch (e) {
    console.error("Submit proof error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get agreement (read)
app.get("/agreement/:id", async (req, res) => {
  try {
    const result = await client.readContract({
      address: AGENTPACT_ADDR,
      functionName: "get_agreement",
      args: [req.params.id],
    });

    res.json({ success: true, data: result });
  } catch (e) {
    console.error("Get agreement error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get nonce (read)
app.get("/nonce/:id", async (req, res) => {
  try {
    const result = await client.readContract({
      address: AGENTPACT_ADDR,
      functionName: "get_nonce",
      args: [req.params.id],
    });

    res.json({ success: true, data: result });
  } catch (e) {
    console.error("Get nonce error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── Start Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Worker server running on http://localhost:${PORT}`);
});
