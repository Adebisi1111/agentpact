# v0.3.0
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import genlayer as gl
from genlayer.types import *


@gl.storage.allow
class ServiceAgreement:
    id: str
    hiree: str
    worker: str
    terms: str
    payment_per_tick: gl.u256
    interval_seconds: gl.u256
    next_deadline: gl.u256
    total_ticks: gl.u256
    paid_ticks: gl.u256
    status: str
    violations: gl.u256
    last_proof_hash: str
    last_check_status: str
    last_response_time: gl.u256
    consecutive_failures: gl.u256
    uptime_required: gl.u256
    response_time_required: gl.u256
    penalty_rate: gl.u256
    total_deposited: gl.u256
    total_paid_out: gl.u256
    total_refunded: gl.u256
    total_penalties: gl.u256


class AgentPact(gl.contract.Contract):
    agreements: gl.storage.TreeMap[str, ServiceAgreement]
    nonces: gl.storage.TreeMap[str, gl.u256]
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
        payment_per_tick: gl.u256,
        interval_seconds: gl.u256,
        total_ticks: gl.u256,
        uptime_required: gl.u256,
        response_time_required: gl.u256,
        penalty_rate: gl.u256,
    ) -> str:
        if self.agreements.get(agreement_id) is not None:
            raise ValueError("Agreement ID already exists")
        if payment_per_tick <= 0:
            raise ValueError("Payment per tick must be positive")
        if gl.Address(worker).as_hex == gl.message.sender_address.as_hex:
            raise ValueError("Worker cannot be the same as hiree")
        agreement = ServiceAgreement()
        agreement.id = agreement_id
        agreement.hiree = gl.message.sender_address.as_hex
        agreement.worker = gl.Address(worker).as_hex
        agreement.terms = terms
        agreement.payment_per_tick = payment_per_tick
        agreement.interval_seconds = interval_seconds
        agreement.next_deadline = gl.u256(0)
        agreement.total_ticks = total_ticks
        agreement.paid_ticks = gl.u256(0)
        agreement.status = "pending"
        agreement.violations = gl.u256(0)
        agreement.last_proof_hash = ""
        agreement.last_check_status = ""
        agreement.last_response_time = gl.u256(0)
        agreement.consecutive_failures = gl.u256(0)
        agreement.uptime_required = uptime_required
        agreement.response_time_required = response_time_required
        agreement.penalty_rate = penalty_rate
        agreement.total_deposited = gl.u256(0)
        agreement.total_paid_out = gl.u256(0)
        agreement.total_refunded = gl.u256(0)
        agreement.total_penalties = gl.u256(0)
        self.agreements[agreement_id] = agreement
        self.agreement_counter += gl.u256(1)
        return agreement_id

    @gl.public.write.payable
    def fund_agreement(self, agreement_id: str) -> str:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Agreement not found")
        if agreement.status != "pending":
            raise ValueError("Can only fund pending")
        total = agreement.payment_per_tick * agreement.total_ticks
        if gl.message.value < total:
            raise ValueError("Insufficient escrow")
        agreement.total_deposited = gl.u256(gl.message.value)
        agreement.status = "active"
        agreement.next_deadline = gl.u256(self._now()) + agreement.interval_seconds
        self.agreements[agreement_id] = agreement
        return "Funded"

    @gl.public.write
    def submit_proof(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Not found")
        if agreement.status != "active":
            raise ValueError("Not active")
        if gl.u256(self._now()) < agreement.next_deadline:
            raise ValueError("Too early")

        def get_proof() -> dict:
            import hashlib
            response = gl.nondet.web.render(
                url=agreement.terms,
                method="GET",
                headers={"User-Agent": "AgentPact/1.0"},
                timeout=10,
            )
            body = response.get("body", "")
            proof_hash = hashlib.sha256(body.encode()).hexdigest()
            return {"proof_hash": proof_hash}

        def validate_proof(result) -> bool:
            if not isinstance(result, gl.vm.Return):
                return False
            calldata = result.calldata
            return (
                isinstance(calldata, dict)
                and "proof_hash" in calldata
                and isinstance(calldata["proof_hash"], str)
                and len(calldata["proof_hash"]) == 64
            )

        result = gl.vm.run_nondet_unsafe(get_proof, validate_proof)
        agreement.last_proof_hash = result["proof_hash"]
        agreement.last_check_status = "passed"
        agreement.paid_ticks += gl.u256(1)
        agreement.consecutive_failures = gl.u256(0)
        agreement.total_paid_out += agreement.payment_per_tick
        agreement.next_deadline = gl.u256(self._now()) + agreement.interval_seconds
        if agreement.paid_ticks >= agreement.total_ticks:
            agreement.status = "completed"
            excess = agreement.total_deposited - agreement.total_paid_out - agreement.total_penalties
            if excess > gl.u256(0):
                agreement.total_refunded += excess
        self.agreements[agreement_id] = agreement
        self.proof_counter += gl.u256(1)
        return True

    @gl.public.write
    def report_violation(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Not found")
        if agreement.status != "active":
            raise ValueError("Not active")
        agreement.last_check_status = "failed"
        agreement.violations += gl.u256(1)
        agreement.consecutive_failures += gl.u256(1)
        penalty = (agreement.payment_per_tick * agreement.penalty_rate) / gl.u256(100)
        agreement.total_penalties += penalty
        if agreement.consecutive_failures >= gl.u256(3):
            agreement.status = "suspended"
        agreement.next_deadline = gl.u256(self._now()) + agreement.interval_seconds
        self.agreements[agreement_id] = agreement
        return True

    @gl.public.write
    def cancel_agreement(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Not found")
        if str(gl.message.sender_address) != agreement.hiree:
            raise ValueError("Only hiree")
        agreement.status = "cancelled"
        self.agreements[agreement_id] = agreement
        return True

    @gl.public.view
    def get_agreement(self, agreement_id: str) -> ServiceAgreement:
        return self.agreements.get(agreement_id)

    @gl.public.view
    def get_nonce(self, agreement_id: str) -> gl.u256:
        return self.nonces.get(agreement_id, gl.u256(0))

    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "total_agreements": self.agreement_counter,
            "total_proofs": self.proof_counter,
        }

    @gl.public.view
    def get_uptime_percentage(self, agreement_id: str) -> gl.u256:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return gl.u256(0)
        total_checks = agreement.paid_ticks + agreement.violations
        if total_checks == gl.u256(0):
            return gl.u256(100)
        uptime = (agreement.paid_ticks * gl.u256(100)) / total_checks
        return uptime

    @gl.public.view
    def is_due(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return False
        if agreement.status != "active":
            return False
        return gl.u256(self._now()) >= agreement.next_deadline
