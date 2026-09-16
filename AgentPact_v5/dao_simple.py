# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass


class AgentPact(gl.Contract):
    agreements: TreeMap[str, dict]
    agreement_counter: u256
    proof_counter: u256

    def __init__(self):
        self.agreements = TreeMap[str, dict]()
        self.agreement_counter = u256(0)
        self.proof_counter = u256(0)

    def _now(self) -> int:
        import datetime
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    @gl.public.write
    def create_agreement(
        self,
        agreement_id: str,
        worker: str,
        terms: str,
        payment_per_tick: u256,
        interval_seconds: u256,
        total_ticks: u256,
        uptime_required: u256,
        response_time_required: u256,
        penalty_rate: u256,
    ) -> str:
        if self.agreements.get(agreement_id) is not None:
            raise gl.vm.UserError("Agreement ID already exists")

        if payment_per_tick <= u256(0):
            raise gl.vm.UserError("Payment per tick must be positive")

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
            "next_deadline": 0,
            "total_ticks": int(total_ticks),
            "paid_ticks": 0,
            "status": "pending",
            "violations": 0,
            "last_proof_hash": "",
            "last_check_status": "",
            "last_response_time": 0,
            "consecutive_failures": 0,
            "uptime_required": int(uptime_required),
            "response_time_required": int(response_time_required),
            "penalty_rate": int(penalty_rate),
            "total_deposited": 0,
            "total_paid_out": 0,
            "total_refunded": 0,
            "total_penalties": 0,
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
            raise gl.vm.UserError("Must send GEN to fund agreement")

        if gl.message.value < total_escrow:
            raise gl.vm.UserError("Insufficient escrow")

        agreement["total_deposited"] = int(gl.message.value)
        agreement["status"] = "active"
        agreement["next_deadline"] = self._now() + int(agreement["interval_seconds"])

        self.agreements[agreement_id] = agreement
        return "Funded"

    @gl.public.write
    def submit_proof(self, agreement_id: str, proof_hash: str, response_time: u256) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise gl.vm.UserError("Agreement not found")

        if agreement["status"] != "active":
            raise gl.vm.UserError("Agreement is not active")

        if proof_hash == "":
            raise gl.vm.UserError("Proof hash cannot be empty")

        agreement["last_proof_hash"] = proof_hash
        agreement["last_response_time"] = int(response_time)
        agreement["last_check_status"] = "passed"
        agreement["paid_ticks"] = int(agreement["paid_ticks"]) + 1
        agreement["consecutive_failures"] = 0

        agreement["total_paid_out"] = int(agreement["total_paid_out"]) + int(agreement["payment_per_tick"])
        agreement["next_deadline"] = self._now() + int(agreement["interval_seconds"])

        if int(agreement["paid_ticks"]) >= int(agreement["total_ticks"]):
            agreement["status"] = "completed"
            excess = int(agreement["total_deposited"]) - int(agreement["total_paid_out"]) - int(agreement["total_penalties"])
            if excess > 0:
                agreement["total_refunded"] = int(agreement["total_refunded"]) + excess

        self.agreements[agreement_id] = agreement
        self.proof_counter += u256(1)
        return True

    @gl.public.write
    def report_violation(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise gl.vm.UserError("Agreement not found")

        if agreement["status"] != "active":
            raise gl.vm.UserError("Agreement is not active")

        agreement["last_check_status"] = "failed"
        agreement["violations"] = int(agreement["violations"]) + 1
        agreement["consecutive_failures"] = int(agreement["consecutive_failures"]) + 1

        penalty = (u256(agreement["payment_per_tick"]) * u256(agreement["penalty_rate"])) / u256(100)
        agreement["total_penalties"] = int(agreement["total_penalties"]) + int(penalty)

        if int(agreement["consecutive_failures"]) >= 3:
            agreement["status"] = "suspended"
            remaining_ticks = int(agreement["total_ticks"]) - int(agreement["paid_ticks"])
            refund = (remaining_ticks * int(agreement["payment_per_tick"])) - int(agreement["total_penalties"])
            if refund > 0:
                agreement["total_refunded"] = int(agreement["total_refunded"]) + refund

        agreement["next_deadline"] = self._now() + int(agreement["interval_seconds"])

        self.agreements[agreement_id] = agreement
        return True

    @gl.public.write
    def cancel_agreement(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise gl.vm.UserError("Agreement not found")

        if str(gl.message.sender_address) != agreement["hiree"]:
            raise gl.vm.UserError("Only hiree can cancel")

        if agreement["status"] != "active":
            raise gl.vm.UserError("Can only cancel active agreements")

        remaining_ticks = int(agreement["total_ticks"]) - int(agreement["paid_ticks"])
        refund_amount = (remaining_ticks * int(agreement["payment_per_tick"])) - int(agreement["total_penalties"])

        agreement["status"] = "cancelled"
        agreement["total_refunded"] = int(agreement["total_refunded"]) + refund_amount

        self.agreements[agreement_id] = agreement
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

    @gl.public.view
    def get_uptime_percentage(self, agreement_id: str) -> u256:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return u256(0)

        total_checks = u256(agreement["paid_ticks"]) + u256(agreement["violations"])
        if total_checks == u256(0):
            return u256(100)

        uptime = (u256(agreement["paid_ticks"]) * u256(100)) / total_checks
        return uptime

    @gl.public.view
    def is_due(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return False
        if agreement["status"] != "active":
            return False
        return u256(self._now()) >= u256(agreement["next_deadline"])
