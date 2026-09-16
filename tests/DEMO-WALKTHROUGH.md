# AgentPact v5 Integration Test — Demo Walkthrough

## Overview

AgentPact v5 uses **GenLayer validators to verify service evidence** directly, instead of trusting caller-submitted hashes. This document explains the real flow for testers.

## Contract Details

| Field | Value |
|-------|-------|
| **Address** | `0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063` |
| **Network** | GenLayer Studio Next (Chain ID 61997) |
| **RPC** | `https://studio-next.genlayer.com/api` |
| **Explorer** | https://explorer-studio-dev.genlayer.com/address/0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063 |

## Full Test Flow (Run These Commands)

### Step 1: Create Agreement

```bash
# Switch to Studio Next network
genlayer network set studio-next

# Create agreement (no funds locked yet — just stores configuration)
genlayer write 0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063 create_agreement \
  --args "DEMO-001" "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" "https://example.com" 1000 3600 5 90 2000 10
```

**Expected:** Transaction succeeds, agreement stored as "pending".

### Step 2: Fund Agreement (Deposit Escrow)

```bash
# Fund with exactly payment_per_tick × total_ticks = 5000 wei
genlayer write 0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063 fund_agreement \
  --args "DEMO-001" --value 5000
```

**Expected:** Agreement becomes "active", deadline set to now + 3600 seconds.

### Step 3: Submit Proof (Validators Verify)

```bash
# Submit proof — NO hash parameter! Validators fetch the URL themselves
genlayer write 0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063 submit_proof \
  --args "DEMO-001"
```

**What happens inside the contract:**
1. **Leader** calls `gl.nondet.web.render(url="https://example.com")` to fetch the page
2. **Leader** computes `SHA-256(body)` of the response
3. **All validators** do the same independently
4. **Equivalence principle** ensures results match
5. If consensus agrees → proof recorded, payment released

**Expected:** Transaction succeeds. Validators computed the same hash.

### Step 4: Verify State Changes

```bash
# Read final stats
curl -s https://studio-next.genlayer.com/api -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063","data":"0x61837e41"},"latest"]}'
```

**Expected response:** Two uint256 values showing `total_agreements >= 1` and `total_proofs >= 1`.

## What Changed (Steward Request)

| Before (v4) | After (v5) |
|-------------|------------|
| `submit_proof(id, hash, latency)` — trusted caller input | `submit_proof(id)` — validators verify directly |
| Empty/nonempty hash accepted | Validators compute SHA-256 of response body |
| No equivalence principle block | `gl.vm.run_nondet_unsafe(work, validator)` wraps web fetch |
| Caller could fake proof | All validators must agree on result |

## Visual Demo

See the landing page at **https://adebisi1111.github.io/agentpact/** for:
- Hero section explaining "Proof, Not Promises"
- How It Works section (Create → Submit Proof → Verify & Pay)
- Interactive app panel with the new flow
- FAQ explaining validator verification

## Run the Test Suite

```bash
cd /home/administrator/agentpact
node tests/integration-studio-next.mjs
```

Expected output:
```
[2026-09-16T...] Starting AgentPact v5 Integration Test
[2026-09-16T...] Account: 0x61fd00...
[2026-09-16T...] Contract: 0x36aD11...
[2026-09-16T...] Agreement ID: TEST-...

--- Step 1: Create Agreement ---
Create TX: 0x...
Create receipt status: FINALIZED
Create txExecutionResultName: FINISHED_WITH_RETURN

--- Step 2: Fund Agreement ---
Fund TX: 0x...
Fund receipt status: FINALIZED
Fund txExecutionResultName: FINISHED_WITH_RETURN

--- Step 3: Submit Proof (Validators Verify) ---
Validators will fetch https://example.com and compute SHA-256...
Proof TX: 0x...
Proof receipt status: FINALIZED
Proof txExecutionResultName: FINISHED_WITH_RETURN

--- Step 4: Read Final Stats ---
Total agreements: 1
Total proofs: 1

=== TEST SUMMARY ===
✅ TEST PASSED: Validator-verified proof works!
```
