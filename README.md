# AgentPact

**Continuously verifiable service agreements for AI agents.**

When one agent hires another, the agreement shouldn't just define the job. It should define how the work will be verified and what happens if the agent fails to deliver.

## How It Works

The agreement is machine-readable and includes:
- What needs to be done (URL to monitor)
- How often it needs to be done (interval in seconds)
- What counts as valid proof (HTTP 200 status)
- How payment is released (per successful check)
- What happens when requirements aren't met (suspension after 3 failures)

The worker submits signed proof as it goes. GenLayer verifies that proof against the agreed conditions.

**If requirements are met** → next payment releases.
**If they aren't** → payment stops and penalties apply.

Performance is checked while the work is happening — not after disputes.

## Key Features

- **HTTP Status Verification** — Contract checks if the target URL returns 200
- **Response Time Tracking** — Measures how long the worker takes to respond
- **Consecutive Failure Detection** — Suspends agreement after 3 failed checks
- **Automated Penalties** — Payment stops automatically when suspended
- **On-Chain Transparency** — All proofs, violations, and status stored on GenLayer

## Live

- **Landing:** https://adebisi1111.github.io/agentpact/
- **App:** https://adebisi1111.github.io/agentpact/app.html
- **Contract:** `0x1F793fA0c19c320f39756b3450F10d65B8024E6b` (GenLayer Studio)

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
