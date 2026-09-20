// backend/server.js - GenLayer Backend Relay Server for AgentPact
// Signs transactions with private key and routes through Studio Next Consensus

import express from "express";
import cors from "cors";
import { createClient } from "genlayer-js";
import { privateKeyToAccount } from "viem/accounts";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Configuration ──────────────────────────────────────────────
const AGENTPACT_ADDR = process.env.AGENTPACT_ADDR || "0x9F38f3Bf675aD1ACD23881509b6533eBD7F05F77";
const PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("SERVER_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// ─── GenLayer Client (signs with private key) ───────────────────
const account = privateKeyToAccount(PRIVATE_KEY);

// Studio Next custom chain config
const studioNext = {
  id: 61997,
  name: "Studio Next",
  rpcUrls: { default: { http: ["https://studio-next.genlayer.com/api"] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  testnet: true,
  consensusMainContract: {
    address: "0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D",
    abi: [],
  },
  defaultNumberOfInitialValidators: 5,
  defaultConsensusMaxRotations: 3,
};

const client = createClient({ chain: studioNext, account });

console.log("AgentPact Backend Relay Server");
console.log("Account:", account.address);
console.log("Contract:", AGENTPACT_ADDR);

// ─── Routes ─────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", account: account.address, contract: AGENTPACT_ADDR });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", account: account.address, contract: AGENTPACT_ADDR });
});

// Get stats
app.get("/stats", async (req, res) => {
  try {
    const result = await client.readContract({
      address: AGENTPACT_ADDR,
      functionName: "get_stats",
      args: [],
    });
    res.json({ success: true, data: result });
  } catch (e) {
    console.error("Stats error:", e);
    res.json({ success: true, data: { total_agreements: 0, total_proofs: 0 } });
  }
});

// Create agreement
app.post("/create-agreement", async (req, res) => {
  try {
    const { agreementId, worker, terms, paymentPerTick, intervalSeconds, totalPayments, uptimeRequired, responseTimeRequired, penaltyRate } = req.body;

    if (!agreementId || !worker || !terms || !paymentPerTick || !intervalSeconds || !totalPayments || !uptimeRequired || !responseTimeRequired || !penaltyRate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "create_agreement",
      args: [agreementId, worker, terms, BigInt(paymentPerTick), BigInt(intervalSeconds), BigInt(totalPayments), BigInt(uptimeRequired), BigInt(responseTimeRequired), BigInt(penaltyRate)],
      gasLimit: 5000000n,
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Create agreement error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Submit proof (v11: only takes agreement_id - validators fetch URL themselves)
app.post("/submit-proof", async (req, res) => {
  try {
    const { agreementId } = req.body;

    if (!agreementId) {
      return res.status(400).json({ error: "Missing agreementId" });
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "submit_proof",
      args: [agreementId],
      gasLimit: 5000000n,
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Submit proof error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Fund agreement
app.post("/fund-agreement", async (req, res) => {
  try {
    const { agreementId, value } = req.body;

    if (!agreementId) {
      return res.status(400).json({ error: "Missing agreementId" });
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "fund_agreement",
      args: [agreementId],
      value: BigInt(value || 0),
      gasLimit: 5000000n,
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Fund agreement error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Report violation
app.post("/report-violation", async (req, res) => {
  try {
    const { agreementId } = req.body;

    if (!agreementId) {
      return res.status(400).json({ error: "Missing agreementId" });
    }

    const txHash = await client.writeContract({
      address: AGENTPACT_ADDR,
      functionName: "report_violation",
      args: [agreementId],
      gasLimit: 5000000n,
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Report violation error:", e);
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

// Serve static files
app.use(express.static("."));

// ─── Start Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
