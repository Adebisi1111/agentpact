# AgentPact — Project State

## Overview
AgentPact is a prediction market on whether an AI agent's deliverable meets stated criteria, settled by GenLayer consensus. GEN stakes, parimutuel payout.

## Status: Full App Complete — Vercel Deployment In Progress

## Contract
- **Address:** `0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04` (Bradbury)
- **Source:** `/home/administrator/agentpact/contracts/agentpact.py`
- **Size:** 13,840 bytes
- **sha256:** `9c34dbfc…`
- **Tests:** 27/27 pass
- **Live end-to-end:** 3/3 committed (`verdict_counts: {a:1, b:1, tie:1, total:3}`)

## Frontend
- **Framework:** React + Vite
- **Dependencies:** wagmi, viem, @tanstack/react-query, genlayer-js, @walletconnect/ethereum-provider
- **Contract interaction:** wagmi/viem with GenLayer RPC (`https://rpc-bradbury.genlayer.com`)
- **Files:** `/home/administrator/agentpact/frontend/` (src/main.jsx, src/App.jsx, src/styles.css, src/utils/contract.ts, vite.config.js)
- **Build:** Production build completes successfully (150.75 kB JS, 7.03 kB CSS)
- **Deployment:** Pushed to GitHub `Adebisi1111/agentpact.git` (commit `5ab4b0b`)

## API Routes (Vercel serverless functions)
- `api/markets.js` — list markets
- `api/create-market.js` — create new market
- `api/stake.js` — stake YES/NO
- `api/claim.js` — claim payout
- `api/position.js` — get position
- `api/verify.js` — contract verification

## Vercel Deployment
- **Project:** `agentpact` (new)
- **Config:** `vercel.json` with `@vercel/static-build` for frontend
- **Dependencies:** wagmi, viem, genlayer-js
- **Status:** Code pushed to GitHub, Vercel CLI authentication blocked
- **Next:** Get Vercel token to deploy

## Issues & Notes
1. **Vercel CLI not authenticated** — GitHub token is not accepted by Vercel API
2. **Backend API** — ✓ Complete, ready for Vercel deployment
3. **Frontend** — ✓ Complete, deployed to GitHub
4. **Contract** — ✓ Deployed, verified
5. **Live tests** — ✓ 3/3 committed

## Next Steps
1. Set VERCEL_TOKEN environment variable
2. Deploy frontend to Vercel using `vercel --prod --yes` (requires auth)
3. Verify deployment is live
4. Add deployment URL to README
