// wallet.mjs - Frontend API calls to backend relay server for AgentPact
const API = "https://agentpact-backend.onrender.com";

// Create agreement via backend relay
export async function createAgreement(agreementId, worker, terms, paymentPerTick, intervalSeconds, totalPayments) {
  const res = await fetch(`${API}/create-agreement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementId, worker, terms, paymentPerTick, intervalSeconds, totalPayments }),
  });
  return res.json();
}

// Submit proof via backend relay
export async function submitProof(agreementId, proofUrl, nonce) {
  const res = await fetch(`${API}/submit-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementId, proofUrl, nonce }),
  });
  return res.json();
}

// Cancel agreement via backend relay
export async function cancelAgreement(agreementId) {
  const res = await fetch(`${API}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementId }),
  });
  return res.json();
}

// Get agreement via backend relay
export async function getAgreement(agreementId) {
  const res = await fetch(`${API}/agreement/${agreementId}`);
  return res.json();
}

// Get nonce via backend relay
export async function getNonce(agreementId) {
  const res = await fetch(`${API}/nonce/${agreementId}`);
  return res.json();
}
