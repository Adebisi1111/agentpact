# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

import json
from dataclasses import dataclass
import genlayer as gl
from genlayer.storage import allow as allow_storage


@allow_storage
@dataclass
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
        if interval_seconds <= 0:
            raise ValueError("Interval must be positive")
        if total_ticks <= 0:
            raise ValueError("Total ticks must be positive")
        if gl.Address(worker).as_hex == gl.message.sender_address.as_hex:
            raise ValueError("Worker cannot be the same as hiree")
        agreement = ServiceAgreement(
            id=agreement_id,
            hiree=gl.message.sender_address.as_hex,
            worker=gl.Address(worker).as_hex,
            terms=terms,
            payment_per_tick=payment_per_tick,
            interval_seconds=interval_seconds,
            next_deadline=gl.u256(0),
            total_ticks=total_ticks,
            paid_ticks=gl.u256(0),
            status="pending",
            violations=gl.u256(0),
            last_proof_hash="",
            last_check_status="",
            last_response_time=gl.u256(0),
            consecutive_failures=gl.u256(0),
            uptime_required=uptime_required,
            response_time_required=response_time_required,
            penalty_rate=penalty_rate,
            total_deposited=gl.u256(0),
            total_paid_out=gl.u256(0),
            total_refunded=gl.u256(0),
            total_penalties=gl.u256(0),
        )
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

        # Validator: independently fetch URL and compute hash via consensus
        def get_proof_hash() -> str:
            import hashlib
            web_data = gl.nondet.web.render(agreement.terms, mode="text")
            return hashlib.sha256(web_data.encode()).hexdigest()

        # All validators compute the same hash
        validator_hash = gl.eq_principle.strict_eq(get_proof_hash)

        agreement.last_proof_hash = validator_hash
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
