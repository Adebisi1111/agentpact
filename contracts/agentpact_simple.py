# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class AgentPact(gl.Contract):
    agreements: TreeMap[str, dict]
    agreement_counter: u256
    proof_counter: u256

    def __init__(self):
        self.agreements = TreeMap[str, dict]()
        self.agreement_counter = u256(0)
        self.proof_counter = u256(0)

    @gl.public.write
    def create_agreement(
        self,
        agreement_id: str,
        worker: str,
        terms: str,
        payment_per_tick: u256,
        interval_seconds: u256,
        total_ticks: u256,
    ) -> str:
        if self.agreements.get(agreement_id) is not None:
            raise gl.vm.UserError("Agreement ID already exists")

        if payment_per_tick <= u256(0):
            raise gl.vm.UserError("Payment must be positive")

        if interval_seconds <= u256(0):
            raise gl.vm.UserError("Interval must be positive")

        if total_ticks <= u256(0):
            raise gl.vm.UserError("Total ticks must be positive")

        self.agreements[agreement_id] = {
            "id": agreement_id,
            "hiree": str(gl.message.sender_address),
            "worker": worker,
            "terms": terms,
            "payment_per_tick": int(payment_per_tick),
            "interval_seconds": int(interval_seconds),
            "total_ticks": int(total_ticks),
            "paid_ticks": 0,
            "status": "pending",
            "total_deposited": 0,
            "total_paid_out": 0,
        }
        self.agreement_counter += u256(1)
        return agreement_id

    @gl.public.write.payable
    def fund_agreement(self, agreement_id: str) -> str:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise gl.vm.UserError("Agreement not found")

        if agreement["status"] != "pending":
            raise gl.vm.UserError("Can only fund pending agreements")

        total_escrow = u256(agreement["payment_per_tick"]) * u256(agreement["total_ticks"])

        if gl.message.value <= u256(0):
            raise gl.vm.UserError("Must send GEN")

        if gl.message.value < total_escrow:
            raise gl.vm.UserError("Insufficient escrow")

        agreement["total_deposited"] = int(gl.message.value)
        agreement["status"] = "active"
        self.agreements[agreement_id] = agreement
        return "Funded"

    @gl.public.write
    def submit_proof(self, agreement_id: str, proof_hash: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise gl.vm.UserError("Agreement not found")

        if agreement["status"] != "active":
            raise gl.vm.UserError("Agreement is not active")

        if proof_hash == "":
            raise gl.vm.UserError("Proof hash cannot be empty")

        agreement["paid_ticks"] = int(agreement["paid_ticks"]) + 1
        agreement["total_paid_out"] = int(agreement["total_paid_out"]) + int(agreement["payment_per_tick"])

        if int(agreement["paid_ticks"]) >= int(agreement["total_ticks"]):
            agreement["status"] = "completed"

        self.agreements[agreement_id] = agreement
        self.proof_counter += u256(1)
        return True

    @gl.public.view
    def get_agreement(self, agreement_id: str):
        return self.agreements.get(agreement_id)

    @gl.public.view
    def get_stats(self):
        return {
            "total_agreements": self.agreement_counter,
            "total_proofs": self.proof_counter,
        }
