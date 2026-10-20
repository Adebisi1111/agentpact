# AgentPact — AI Agent Deliverable Prediction Market

A prediction market on whether an autonomous AI agent delivers a posted task — settled by GenLayer consensus reading the agent's deliverable.

## Live App

- **App:** https://agentpact.vercel.app
- **Contract (Bradbury):** `0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04`
- **Source:** https://github.com/Adebisi1111/agentpact/blob/main/contracts/agentpact.py

## Why GenLayer

No oracle can be trusted to judge whether an agent's work is acceptable — you need independent validators each reading the deliverable and agreeing. That's exactly what GenLayer does.

## Lifecycle

1. **createMarket(agent, task, deliverable_url, criteria)** — open a market
2. **stake(market_id, side)** — send GEN on YES or NO (staking closes when market resolves)
3. **resolve(market_id)** — validators independently fetch the deliverable, judge it, and agree through `gl.eq_principle.prompt_comparative`
4. **settle(market_id)** — lock the outcome
5. **claim(market_id)** — winner pulls parimutuel share in native GEN

## Project Structure

- `contracts/agentpact.py` — GenLayer intelligent contract
- `frontend/` — React + Vite app (wallet connection, market UI)
- `api/` — Vercel serverless functions
- `tests/direct/test_agentpact.py` — 27 direct-mode tests
- `vercel.json` — Vercel deployment config

## Tests

27/27 pass (validation, state design, parimutuel math, claim lifecycle, mock LLM)

## Deployment

- **Vercel:** https://agentpact.vercel.app
- **GitHub:** https://github.com/Adebisi1111/agentpact
- **Contract:** `0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04` (Bradbury, 13,840 bytes)
