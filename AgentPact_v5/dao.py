# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import json
import genlayer as gl


class AgentPact(gl.contract.Contract):
    agreements: gl.storage.TreeMap[str, str]
    agreement_counter: gl.u256
    proof_counter: gl.u256

    def __init__(self):
        pass

    def _now(self) -> int:
        import datetime
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    @gl.public.write
    def create_agreement(
        self,
        agreement_id: str,
        worker: str,
        terms: str,
        payment_per_tick: int,
        interval_seconds: int,
        total_ticks: int,
        uptime_required: int,
        response_time_required: int,
        penalty_rate: int,
    ) -> str:
        if self.agreements.get(agreement_id) is not None:
            raise gl.vm.UserError("Agreement ID already exists")

        if payment_per_tick <= 0:
            raise gl.vm.UserError("Payment per tick must be positive")

        if interval_seconds <= 0:
            raise gl.vm.UserError("Interval must be positive")

        if total_ticks <= 0:
            raise gl.vm.UserError("Total ticks must be positive")

        if gl.Address(worker).as_hex == gl.message.sender_address.as_hex:
            raise gl.vm.UserError("Worker cannot be the same as hiree")

        agreement = {
            "id": agreement_id,
            "hiree": gl.message.sender_address.as_hex,
            "worker": gl.Address(worker).as_hex,
            "terms": terms,
            "payment_per_tick": payment_per_tick,
            "interval_seconds": interval_seconds,
            "next_deadline": 0,
            "total_ticks": total_ticks,
            "paid_ticks": 0,
            "status": "pending",
            "violations": 0,
            "last_proof_hash": "",
            "last_check_status": "",
            "last_response_time": 0,
            "consecutive_failures": 0,
            "uptime_required": uptime_required,
            "response_time_required": response_time_required,
            "penalty_rate": penalty_rate,
            "total_deposited": 0,
            "total_paid_out": 0,
            "total_refunded": 0,
            "total_penalties": 0,
        }
        self.agreements[agreement_id] = json.dumps(agreement)
        self.agreement_counter += gl.u256(1)
        return agreement_id

    @gl.public.write.payable
    def fund_agreement(self, agreement_id: str) -> str:
        raw = self.agreements.get(agreement_id)
        if raw is None:
            raise gl.vm.UserError("Agreement not found")

        agreement = json.loads(raw)
        if agreement["status"] != "pending":
            raise gl.vm.UserError("Can only fund pending agreements")

        pay = gl.u256(agreement["payment_per_tick"])
        total = gl.u256(agreement["total_ticks"])
        total_escrow = pay * total

        if gl.message.value <= gl.u256(0):
            raise gl.vm.UserError("Must send GEN to fund agreement")

        if gl.message.value < total_escrow:
            raise gl.vm.UserError("Insufficient escrow")

        agreement["total_deposited"] = int(gl.message.value)
        agreement["status"] = "active"
        agreement["next_deadline"] = self._now() + agreement["interval_seconds"]

        self.agreements[agreement_id] = json.dumps(agreement)
        return "Funded"

    @gl.public.write
    def submit_proof(self, agreement_id: str, proof_hash: str, response_time: int) -> bool:
        raw = self.agreements.get(agreement_id)
        if raw is None:
            raise gl.vm.UserError("Agreement not found")

        agreement = json.loads(raw)
        if agreement["status"] != "active":
            raise gl.vm.UserError("Agreement is not active")

        if proof_hash == "":
            raise gl.vm.UserError("Proof hash cannot be empty")

        agreement["last_proof_hash"] = proof_hash
        agreement["last_response_time"] = response_time
        agreement["last_check_status"] = "passed"
        agreement["paid_ticks"] = agreement["paid_ticks"] + 1
        agreement["consecutive_failures"] = 0

        agreement["total_paid_out"] = agreement["total_paid_out"] + agreement["payment_per_tick"]
        agreement["next_deadline"] = self._now() + agreement["interval_seconds"]

        if agreement["paid_ticks"] >= agreement["total_ticks"]:
            agreement["status"] = "completed"
            excess = agreement["total_deposited"] - agreement["total_paid_out"] - agreement["total_penalties"]
            if excess > 0:
                agreement["total_refunded"] = agreement["total_refunded"] + excess

        self.agreements[agreement_id] = json.dumps(agreement)
        self.proof_counter += gl.u256(1)
        return True

    @gl.public.write
    def report_violation(self, agreement_id: str) -> bool:
        raw = self.agreements.get(agreement_id)
        if raw is None:
            raise gl.vm.UserError("Agreement not found")

        agreement = json.loads(raw)
        if agreement["status"] != "active":
            raise gl.vm.UserError("Agreement is not active")

        agreement["last_check_status"] = "failed"
        agreement["violations"] = agreement["violations"] + 1
        agreement["consecutive_failures"] = agreement["consecutive_failures"] + 1

        penalty = (agreement["payment_per_tick"] * agreement["penalty_rate"]) // 100
        agreement["total_penalties"] = agreement["total_penalties"] + penalty

        if agreement["consecutive_failures"] >= 3:
            agreement["status"] = "suspended"
            remaining = agreement["total_ticks"] - agreement["paid_ticks"]
            refund = (remaining * agreement["payment_per_tick"]) - agreement["total_penalties"]
            if refund > 0:
                agreement["total_refunded"] = agreement["total_refunded"] + refund

        agreement["next_deadline"] = self._now() + agreement["interval_seconds"]

        self.agreements[agreement_id] = json.dumps(agreement)
        return True

    @gl.public.write
    def cancel_agreement(self, agreement_id: str) -> bool:
        raw = self.agreements.get(agreement_id)
        if raw is None:
            raise gl.vm.UserError("Agreement not found")

        agreement = json.loads(raw)
        if str(gl.message.sender_address) != agreement["hiree"]:
            raise gl.vm.UserError("Only hiree can cancel")

        if agreement["status"] != "active":
            raise gl.vm.UserError("Can only cancel active agreements")

        remaining = agreement["total_ticks"] - agreement["paid_ticks"]
        refund_amount = (remaining * agreement["payment_per_tick"]) - agreement["total_penalties"]

        agreement["status"] = "cancelled"
        agreement["total_refunded"] = agreement["total_refunded"] + refund_amount

        self.agreements[agreement_id] = json.dumps(agreement)
        return True

    @gl.public.view
    def get_agreement(self, agreement_id: str):
        raw = self.agreements.get(agreement_id)
        if raw is None:
            return None
        return json.loads(raw)

    @gl.public.view
    def get_nonce(self, agreement_id: str) -> gl.u256:
        return gl.u256(0)

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "total_agreements": self.agreement_counter,
            "total_proofs": self.proof_counter,
        }

    @gl.public.view
    def get_uptime_percentage(self, agreement_id: str) -> gl.u256:
        raw = self.agreements.get(agreement_id)
        if raw is None:
            return gl.u256(0)

        agreement = json.loads(raw)
        paid = agreement["paid_ticks"]
        violations = agreement["violations"]
        total = paid + violations
        if total == 0:
            return gl.u256(100)

        uptime = (paid * 100) // total
        return gl.u256(uptime)

    @gl.public.view
    def is_due(self, agreement_id: str) -> bool:
        raw = self.agreements.get(agreement_id)
        if raw is None:
            return False

        agreement = json.loads(raw)
        if agreement["status"] != "active":
            return False
        return gl.u256(self._now()) >= gl.u256(agreement["next_deadline"])
