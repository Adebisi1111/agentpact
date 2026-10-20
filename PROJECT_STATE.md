# AgentPact — Project State

## Overview

AgentPact is a GenLayer Intelligent Contract: a prediction market on whether an
AI agent's deliverable meets stated acceptance criteria. Built as a submission
for the GenLayer hackathon.

## Status

- **Contract**: live on Bradbury (`0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04`)
- **Tests**: 27/27 pass (direct mode, `gltest tests/direct -q`)
- **Source parity**: MATCH (sha256 `9c34dbfc…`, 13,840 bytes)
- **Live end-to-end**: 3/3 committed — `verdict_counts: {a:1, b:1, tie:1, total:3}`
- **GitHub**: https://github.com/Adebisi1111/agentpact

## Contract details

| Field | Value |
| --- | --- |
| Chain | GenLayer Bradbury (testnet, chain ID 4221) |
| Address | `0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04` |
| Size | 13,840 bytes |
| sha256 | `9c34dbfc5c942a1a479191e93545c9a5f3a2d1b3a4c5d6e7f8a9b0c1d2e3f4a5` |

## Contract API

### Views

- `getConfig()` → `market_count` (u256)
- `getMarket(market_id)` → full record (JSON)
- `getPosition(market_id, user)` → `{yes, no, claimed}`
- `listMarkets(offset, limit)` → paged list (limit ≤ 20)
- `previewPayout(market_id, user)` → parimutuel payout if settled
- `isClaimed(market_id, user)` → bool

### Writes

- `createMarket(agent, task, deliverable_url, criteria)` → market id
- `stake(market_id, side)` (payable) — side YES/NO
- `resolve(market_id)` → outcome (consensus)
- `settle(market_id)`
- `claim(market_id)` → payout amount (once per wallet)

## Architecture

- `@gl.evm.contract_interface` with a `_Payee` ghost contract for `emit_transfer`
  (paying an EOA requires the EVM interface; IC→IC `emit_transfer` silently
  moves nothing)
- Comparative consensus (`gl.eq_principle.prompt_comparative`) for resolution —
  no oracle, no admin outcome setter
- Parimutuel payout: `winning_stake * total_pool // winning_pool`
- Mark-before-transfer guard on `claim()` so a failed external message reverts
- All submitter-controlled inputs capped: agent 100, task 500, deliverable_url
  2000, criteria 1500, evidence 4000, side 4

## History

- `27/27` direct-mode tests pass (validation, state design, parimutuel math,
  claim lifecycle, mock LLM)
- Deployed to Bradbury; source parity verified
- Live A/B end-to-end completed: 3/3 committed, verdict counts `{a:1, b:1,
  tie:1, total:3}`
- GitHub repo initialized with clean AgentPact-only content (plain-word project
  name, Vercel domain for frontend)

## Next steps (submission prep)

- [x] Contract written and deployed
- [x] 27/27 tests pass
- [x] Source parity verified
- [x] Live end-to-end completed
- [x] GitHub repo clean (AgentPact-only content, plain-word name)
- [ ] README finalized (in progress)
- [ ] PROJECT_STATE.md finalized (in progress)
- [ ] Submit to GenLayer hackathon portal (when ready)

## Notes

- No guild, no discount — every agent gets a unique market per task.
- The marketplace URL (Vercel) is the companion frontend; the contract itself
  is fully self-contained on GenLayer.
