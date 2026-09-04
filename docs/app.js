// app.js - UI interactions for AgentPact
import { createAgreement, submitProof, cancelAgreement, getAgreement, getNonce } from "./wallet.mjs";

function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status show " + type;
}

document.getElementById("createBtn").addEventListener("click", async () => {
  try {
    showStatus("createStatus", "warn", "Creating agreement...");
    
    const result = await createAgreement(
      document.getElementById("agreementId").value,
      document.getElementById("worker").value,
      document.getElementById("terms").value,
      document.getElementById("paymentPerTick").value,
      document.getElementById("intervalSeconds").value,
      document.getElementById("totalPayments").value
    );
    
    if (result.success) {
      showStatus("createStatus", "ok", "Created! Tx: " + result.txHash);
    } else {
      showStatus("createStatus", "err", "Error: " + result.error);
    }
  } catch(e) {
    showStatus("createStatus", "err", "Error: " + e.message);
  }
});

document.getElementById("submitBtn").addEventListener("click", async () => {
  try {
    showStatus("submitStatus", "warn", "Submitting proof...");
    
    const result = await submitProof(
      document.getElementById("submitAgreementId").value,
      document.getElementById("proofUrl").value,
      document.getElementById("nonce").value
    );
    
    if (result.success) {
      showStatus("submitStatus", "ok", "Submitted! Tx: " + result.txHash);
    } else {
      showStatus("submitStatus", "err", "Error: " + result.error);
    }
  } catch(e) {
    showStatus("submitStatus", "err", "Error: " + e.message);
  }
});

document.getElementById("cancelBtn").addEventListener("click", async () => {
  try {
    showStatus("cancelStatus", "warn", "Cancelling...");
    
    const result = await cancelAgreement(
      document.getElementById("cancelAgreementId").value
    );
    
    if (result.success) {
      showStatus("cancelStatus", "ok", "Cancelled! Tx: " + result.txHash);
    } else {
      showStatus("cancelStatus", "err", "Error: " + result.error);
    }
  } catch(e) {
    showStatus("cancelStatus", "err", "Error: " + e.message);
  }
});

document.getElementById("readBtn").addEventListener("click", async () => {
  try {
    const result = await getAgreement(document.getElementById("readId").value);
    
    if (result.success) {
      document.getElementById("out").style.display = "block";
      document.getElementById("out").textContent = JSON.stringify(result.data, null, 2);
    } else {
      showStatus("readStatus", "err", "Error: " + result.error);
    }
  } catch(e) {
    showStatus("readStatus", "err", "Error: " + e.message);
  }
});

console.log("AgentPact initialized");
