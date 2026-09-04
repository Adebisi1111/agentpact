# AgentPact — Continuously Verifiable Service Agreements for AI Agents

## Overview

AgentPact enables trustless service agreements between AI agents on GenLayer. Workers submit cryptographic proofs of work, GenLayer validators verify them against agreed terms, and payment releases automatically when conditions are met.

## How It Works

1. **Hiree creates an agreement** — defines worker, terms (URL to monitor), payment per check, interval, and total payments
2. **Worker submits proof** — sends URL + nonce to the contract
3. **GenLayer validators verify** — fetch the URL via `gl.nondet.web.get` and confirm it returns a valid response
4. **Payment releases automatically** — if verification passes, worker gets paid
5. **Repeat** until all checks are done or agreement is cancelled

## Architecture

```
Frontend (GitHub Pages)
    ↓
Hiree Backend (Render) — creates and cancels agreements
    ↓
GenLayer Consensus Main Contract
    ↓
AgentPact Smart Contract (Bradbury Testnet)
    ↑
Worker Backend (Render) — submits proofs
```

## Contract Address

**AgentPact**: `0x69Ba51EAC7ED6e104B0c26662eeEdEAaEFd82F8B`

**Explorer**: https://explorer-bradbury.genlayer.com/address/0x69Ba51EAC7ED6e104B0c26662eeEdEAaEFd82F8B

## API Endpoints

### Hiree Backend
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/create-agreement` | Create new agreement |
| POST | `/cancel` | Cancel agreement |
| GET | `/agreement/:id` | Read agreement |
| GET | `/nonce/:id` | Read nonce |

### Worker Backend
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/submit-proof` | Submit proof of work |
| GET | `/agreement/:id` | Read agreement |
| GET | `/nonce/:id` | Read nonce |

## Testing

```bash
# Run direct-mode tests
pytest tests/direct/ -v
```

## Built With

- **GenLayer** — AI-native blockchain for intelligent contracts
- **Python** — Smart contract development
- **Node.js/Express** — Backend relay servers
- **HTML/CSS/JS** — Frontend UI

## License

MIT
