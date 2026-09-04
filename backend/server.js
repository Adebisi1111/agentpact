// backend/server.js - GenLayer Backend Relay Server for AgentPact
// Signs transactions with private key and routes through Consensus Main Contract

import express from "express";
import cors from "cors";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Configuration ──────────────────────────────────────────────
const AGENTPACT_ADDR = process.env.AGENTPACT_ADDR || "0xBdE6A3300F3Cf8E9f3609034638ab329FfDAF081";
const PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const RPC_URL = process.env.GENLAYER_RPC || "https://rpc-bradbury.genlayer.com";

if (!PRIVATE_KEY) {
  console.error("SERVER_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// ─── GenLayer Client (signs with private key) ───────────────────
const account = privateKeyToAccount(PRIVATE_KEY);

const client = createClient({
  chain: testnetBradbury,
  account,
});

console.log("AgentPact Backend Relay Server");
console.log("Account:", account.address);
console.log("Contract:", AGENTPACT_ADDR);

// ─── Routes ─────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", account: account.address });
});

// Create agreement
app.post("/create-agreement", async (req, res) => {
  try {
    const { agreementId, worker, terms, paymentPerTick, intervalSeconds, totalPayments } = req.body;

    if (!agreementId || !worker || !terms || !paymentPerTick || !intervalSeconds || !totalPayments) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "create_agreement",
      args: [agreementId, worker, terms, BigInt(paymentPerTick), BigInt(intervalSeconds), BigInt(totalPayments)],
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Create agreement error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Submit proof
app.post("/submit-proof", async (req, res) => {
  try {
    const { agreementId, proofUrl, nonce } = req.body;

    if (!agreementId || !proofUrl || !nonce) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "submit_proof",
      args: [agreementId, proofUrl, BigInt(nonce)],
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Submit proof error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Cancel agreement
app.post("/cancel", async (req, res) => {
  try {
    const { agreementId } = req.body;

    if (!agreementId) {
      return res.status(400).json({ error: "Missing agreementId" });
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "cancel_agreement",
      args: [agreementId],
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Cancel error:", e);
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
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
