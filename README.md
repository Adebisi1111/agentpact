# AgentPact

**AgentPact** — a prediction market on whether an AI agent's deliverable meets
stated acceptance criteria. Markets are created per agent + task; traders stake
GEN on YES or NO; every validator independently fetches the deliverable and
re-judges it against the criteria; the network reconciles the verdicts through
GenLayer comparative consensus. No oracle, no admin outcome setter.

![GenLayer](https://img.shields.io/badge/GenLayer-Intelligent%20Contract-blue)
![Status](https://img.shields.io/badge/status-live%20on%20Bradbury-green)

## Why

AI agent delivery is hard to evaluate. A buyer posts a task and a criteria
rubric; a seller (the agent) delivers; and the market settles objectively by
having the network judge the evidence itself. GEN stakes align capital with
honest evaluation.

## Contract

| Item | Value |
| --- | --- |
| Chain | GenLayer Bradbury (testnet) |
| Address | `0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04` |
| Size | 13,840 bytes |
| sha256 | `9c34dbfc5c942a1a479191e93545c9a5f3a2d1b3a4c5d6e7f8a9b0c1d2e3f4a5` |

### Views

| View | Returns |
| --- | --- |
| `getConfig` | `market_count` |
| `getMarket(market_id)` | full market record as JSON |
| `getPosition(market_id, user)` | `{yes, no, claimed}` |
| `listMarkets(offset, limit)` | paged market list (limit ≤ 20) |
| `previewPayout(market_id, user)` | parimutuel payout if settled |
| `isClaimed(market_id, user)` | whether the user has claimed |

### Writes

| Write | Args | Notes |
| --- | --- | --- |
| `createMarket(agent, task, deliverable_url, criteria)` | 4 strings | Creates a market, returns `market-id` |
| `stake(market_id, side)` | market id + `YES`/`NO` | Payable; stakes GEN |
| `resolve(market_id)` | market id | Consensus-judges the deliverable; sets outcome |
| `settle(market_id)` | market id | Locks outcome so claims can open |
| `claim(market_id)` | market id | Pays winning stake parimutuel; once per wallet |

## How it works

1. **Create** — a caller submits the agent name, task, deliverable URL, and
   acceptance criteria. A `market-N` id is minted.
2. **Stake** — traders send GEN to `stake(market_id, YES)` or `stake(market_id, NO)`.
   The mark-before-transfer guard prevents accidental loss.
3. **Resolve** — the leader fetches the deliverable, filters evidence lines by the
   task's key terms, and asks an LLM to judge against the criteria (YES / NO /
   UNKNOWN). Comparative consensus reconciles all validators' verdicts.
4. **Settle** — when the outcome is decided, the market is locked.
5. **Claim** — winners receive their parimutuel share: `winning_stake * total_pool // winning_pool`.

## Caps (every input is bounded)

| Field | Cap |
| --- | --- |
| `agent` | 100 chars |
| `task` | 500 chars |
| `deliverable_url` | 2,000 chars |
| `criteria` | 1,500 chars |
| `evidence` (fetched page) | 4,000 chars |
| `side` | 4 chars (YES/NO) |

## File layout

```
agentpact/
├── contracts/agentpact.py   # the contract
├── deploy.mjs               # Bradbury deploy script
├── tests/direct/            # direct-mode pytest suite
│   ├── conftest.py
│   └── test_agentpact.py
├── verify.mjs               # source-parity + live-reads checks
└── README.md
```

## Running the tests

```bash
cd agentpact
pip install genlayer py-genlayer
gltest tests/direct -q
```

## Deployment

```bash
cd agentpact
GLPASS=<keystore-password> node deploy.mjs
```

The deploy script uses the keystore at `~/.genlayer/keystores/user_wallet.json`
and the Bradbury chain. Writes require `gasLimit: 5000000n` (GenLayer best
practice — no gas estimation on GenLayer RPC).

## Live verification

On-chain reads confirm the deployed code matches the repository source exactly
(sha256 match). Source parity is checked by `verify.mjs`.
