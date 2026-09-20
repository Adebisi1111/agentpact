# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *
from genlayer.py.types import Address
from dataclasses import dataclass


@allow_storage
@dataclass
class ServiceAgreement:
    id: str
    hiree: str
    worker: str
    terms: str
    payment_per_tick: u256
    interval_seconds: u256
    next_deadline: u256
    total_ticks: u256
    paid_ticks: u256
    status: str
    violations: u256
    last_proof_hash: str
    last_response_time: u256
    consecutive_failures: u256
    uptime_required: u256
    response_time_required: u256
    penalty_rate: u256
    total_deposited: u256
    total_paid_out: u256


class AgentPact(gl.Contract):
    agreements: TreeMap[str, ServiceAgreement]
    agreement_counter: u256
    proof_counter: u256

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
            raise ValueError("Agreement ID already exists")
        if payment_per_tick <= 0:
            raise ValueError("Payment per tick must be positive")
        if Address(worker).as_hex == gl.message.sender_address.as_hex:
            raise ValueError("Worker cannot be the same as hiree")
        agreement = ServiceAgreement(
            id=agreement_id,
            hiree=gl.message.sender_address.as_hex,
            worker=Address(worker).as_hex,
            terms=terms,
            payment_per_tick=payment_per_tick,
            interval_seconds=interval_seconds,
            next_deadline=u256(0),
            total_ticks=total_ticks,
            paid_ticks=u256(0),
            status="pending",
            violations=u256(0),
            last_proof_hash="",
            last_response_time=u256(0),
            consecutive_failures=u256(0),
            uptime_required=uptime_required,
            response_time_required=response_time_required,
            penalty_rate=penalty_rate,
            total_deposited=u256(0),
            total_paid_out=u256(0),
        )
        self.agreements[agreement_id] = agreement
        self.agreement_counter += u256(1)
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
        agreement.total_deposited = u256(gl.message.value)
        agreement.status = "active"
        agreement.next_deadline = u256(self._now()) + agreement.interval_seconds
        self.agreements[agreement_id] = agreement
        return "Funded"

    def _now(self) -> int:
        import datetime
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    @gl.public.write
    def submit_proof(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Not found")
        if agreement.status != "active":
            raise ValueError("Not active")
        if u256(self._now()) < agreement.next_deadline:
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
        agreement.paid_ticks += u256(1)
        agreement.consecutive_failures = u256(0)
        agreement.total_paid_out += agreement.payment_per_tick
        agreement.next_deadline = u256(self._now()) + agreement.interval_seconds
        if agreement.paid_ticks >= agreement.total_ticks:
            agreement.status = "completed"
        self.agreements[agreement_id] = agreement
        self.proof_counter += u256(1)
        return True

    @gl.public.write
    def report_violation(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Not found")
        if agreement.status != "active":
            raise ValueError("Not active")
        agreement.violations += u256(1)
        agreement.consecutive_failures += u256(1)
        if agreement.consecutive_failures >= u256(3):
            agreement.status = "suspended"
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
    def get_agreement_json(self, agreement_id: str) -> str:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return json.dumps({"error": "not found"})
        return json.dumps({
            "id": agreement.id,
            "hiree": agreement.hiree,
            "worker": agreement.worker,
            "terms": agreement.terms,
            "payment_per_tick": str(int(agreement.payment_per_tick)),
            "total_ticks": str(int(agreement.total_ticks)),
            "paid_ticks": str(int(agreement.paid_ticks)),
            "status": agreement.status,
            "violations": str(int(agreement.violations)),
            "last_proof_hash": agreement.last_proof_hash,
            "consecutive_failures": str(int(agreement.consecutive_failures)),
        })

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_agreements": str(int(self.agreement_counter)),
            "total_proofs": str(int(self.proof_counter)),
        })
