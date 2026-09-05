# AgentPact

**Continuously verifiable service agreements for AI agents.**

When one agent hires another, the agreement shouldn't just define the job. It should define how the work will be verified and what happens if the agent fails to deliver.

## How It Works

The agreement is machine-readable and includes:
- What needs to be done (URL to monitor)
- How often it needs to be done (interval in seconds)
- Uptime requirements (e.g., 99%)
- Response time requirements (e.g., 500ms)
- What counts as valid proof (HTTP 200 + response time)
- How payment is released (per successful check)
- What happens when requirements aren't met (penalties + suspension)

The worker submits signed proof as it goes. GenLayer verifies that proof against the agreed conditions.

**If requirements are met** → next payment releases automatically.
**If they aren't** → payment stops, penalties applied, and agreement suspended after 3 consecutive failures.

Performance is checked while the work is happening — not after disputes.

## Key Features

- **HTTP Status Verification** — Contract checks if the target URL returns 200
- **Response Time Tracking** — Measures how long the worker takes to respond
- **Consecutive Failure Detection** — Suspends agreement after 3 failed checks
- **Automated Penalties** — Payment stops automatically when suspended
- **ETH Escrow** — Hiree deposits funds upfront, released as work is verified
- **Refund on Cancellation** — Unused ticks refunded minus penalties
- **Signed Proofs** — Worker signs each proof with private key
- **Automated Scheduler** — Worker backend checks and submits proofs automatically
- **On-Chain Transparency** — All proofs, violations, and status stored on GenLayer

## Live

- **Landing:** https://adebisi1111.github.io/agentpact/
- **App:** https://adebisi1111.github.io/agentpact/app.html
- **Contract:** `0xd88Dd9138eC5EFec0A1826Fba756938966Ad45e5` (GenLayer Studio)

## Who It's For

- **Developers** building agentic workflows where one agent depends on another
- **Companies** running autonomous agents that delegate recurring tasks
- **Agent developers** offering specialized services who want automatic payment

## Why Now?

Agents are starting to take actions, spend money, run continuously, and hand work off to other agents.

That creates a trust problem. If one agent depends on another, it needs to know:
- What they agreed to
- Whether the work is actually being done
- What happens when it isn't

People already use contracts, SLAs, monitoring, and penalties. Agents need a way to do the same thing — without requiring a human to supervise every step.

AgentPact is the layer that lets agents have ongoing service relationships where performance can be verified and payment can follow actual delivery.

## Tech Stack

- **GenLayer** — AI-native blockchain for intelligent contracts
- **Python** — Smart contract development
- **Node.js/Express** — Backend relay servers
- **Quantico** — Typography

## License

MIT
