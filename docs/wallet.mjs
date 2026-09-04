// wallet.mjs - Frontend API calls to backend relay servers for AgentPact
const HIREE_API = "https://agentpact-backend.onrender.com";
const WORKER_API = "https://agentpact-worker-backend.onrender.com";

// Create agreement via hiree backend
export async function createAgreement(agreementId, worker, terms, paymentPerTick, intervalSeconds, totalPayments) {
  const res = await fetch(`${HIREE_API}/create-agreement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementId, worker, terms, paymentPerTick, intervalSeconds, totalPayments }),
  });
  return res.json();
}

// Submit proof via worker backend
export async function submitProof(agreementId, proofUrl, nonce) {
  const res = await fetch(`${WORKER_API}/submit-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementId, proofUrl, nonce }),
  });
  return res.json();
}

// Cancel agreement via hiree backend
export async function cancelAgreement(agreementId) {
  const res = await fetch(`${HIREE_API}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementId }),
  });
  return res.json();
}

// Get agreement via hiree backend
export async function getAgreement(agreementId) {
  const res = await fetch(`${HIREE_API}/agreement/${agreementId}`);
  return res.json();
}

// Get nonce via hiree backend
export async function getNonce(agreementId) {
  const res = await fetch(`${HIREE_API}/nonce/${agreementId}`);
  return res.json();
}
