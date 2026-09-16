import { test, expect } from '@playwright/test';

// ─── Configuration ───────────────────────────────────────────────────────────
const CONTRACT = '0x36aD11cB39548afB8a7Bd78b7e3F0031866ef063';
const FRONTEND_URL = 'https://adebisi1111.github.io/agentpact/';

// ─── Demo Walkthrough ────────────────────────────────────────────────────────
// This page documents the full AgentPact flow on GenLayer Studio Next

const demoSteps = [
  {
    title: 'Step 1: Connect Wallet',
    description: 'Open the app and connect MetaMask. Switch to GenLayer Studio Next (chain 61997).',
    expected: 'Wallet address appears in the top-right with a green checkmark.',
  },
  {
    title: 'Step 2: Create Agreement',
    description: 'Fill in the form: Agreement ID "DEMO-001", Worker Address (your second wallet or any address), Terms URL (a live URL to monitor like https://example.com), Payment/tick 1000, Interval 3600, Total ticks 5, Uptime 90, Max resp time 2000, Penalty 10. Click Create.',
    expected: 'Transaction signed and sent. Contract records the agreement as "pending". No funds are locked yet.',
  },
  {
    title: 'Step 3: Fund Agreement',
    description: 'Click Fund to deposit escrow. Send exactly Payment/tick × Total ticks = 5000 wei in the transaction.',
    expected: 'Contract status becomes "active". The deadline is set to now + interval. Funds are locked in the contract.',
  },
  {
    title: 'Step 4: Submit Proof (Validator-Verified)',
    description: 'Click Submit Proof. This is where GenLayer validators take over: they fetch the Terms URL, compute a SHA-256 hash of the response body, and compare results. If consensus agrees, the proof is recorded.',
    expected: 'A transaction is sent with no hash parameter. Validators run gl.nondet.web.render() inside gl.vm.run_nondet_unsafe(). The caller cannot fake the proof.',
  },
  {
    title: 'Step 5: Verify Results',
    description: 'Use the GenLayer Explorer or check contract state to see paid_ticks incremented, last_proof_hash recorded, and next_deadline updated.',
    expected: 'Agreement paid_ticks = 1, status = "active" (if more ticks remain) or "completed" (if all done).',
  },
];

// ─── Playwright Tests ─────────────────────────────────────────────────────────

test.describe('AgentPact Frontend', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FRONTEND_URL);
  });

  test('landing page loads with professional UI', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('PROOF, NOT PROMISES');
    await expect(page.locator('.nav-logo-text')).toContainText('agentpact');
  });

  test('FAQ section is interactive', async ({ page }) => {
    const faqItem = page.locator('.faq-item').first();
    await faqItem.click();
    await expect(faqItem).toHaveClass(/open/);
    await expect(faqItem.locator('.faq-answer p')).toBeVisible();
  });

  test('app section is visible', async ({ page }) => {
    await page.locator('#app').scrollIntoViewIfNeeded();
    await expect(page.locator('.app-panel')).toBeVisible();
  });

  test('app shows disconnected badge by default', async ({ page }) => {
    await page.locator('#app').scrollIntoViewIfNeeded();
    await expect(page.locator('.app-badge')).toContainText('Disconnected');
  });
});

test.describe('Contract on GenLayer Studio Next', () => {
  test('get_stats returns total_agreements and total_proofs', async ({ request }) => {
    const response = await request.post('https://studio-next.genlayer.com/api', {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: CONTRACT, data: '0x61837e41' }, 'latest'],
      },
    });
    const json = await response.json();
    expect(json.result).toBeDefined();
    // Should return 2 uint256 values (64 hex chars each)
    expect(json.result.length).toBeGreaterThanOrEqual(130);
  });

  test('contract is on chain 61997', async ({ request }) => {
    const response = await request.post('https://studio-next.genlayer.com/api', {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_chainId',
        params: [],
      },
    });
    const json = await response.json();
    expect(json.result).toBe('0xf22d'); // 61997 in hex
  });
});
