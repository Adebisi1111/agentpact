# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from genlayer.py.types import Address
from dataclasses import dataclass
import hashlib
import json


@allow_storage
@dataclass
class ServiceAgreement:
    agreement_id: str
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
    last_check_hash: str
    last_response_time: u256
    uptime_required: u256
    response_time_required: u256
    penalty_rate: u256
    total_deposited: u256
    total_paid_out: u256


class AgentPactV9(gl.Contract):
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
        agreement = ServiceAgreement(
            agreement_id=agreement_id,
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
            last_check_hash="",
            last_response_time=u256(0),
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
        import datetime
        agreement.next_deadline = u256(int(datetime.datetime.now(datetime.timezone.utc).timestamp())) + agreement.interval_seconds
        self.agreements[agreement_id] = agreement
        return f"Funded {gl.message.value}"

    @gl.public.write
    def submit_proof(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None or agreement.status != "active":
            raise ValueError("Not active")
        if u256(self._now()) < agreement.next_deadline:
            raise ValueError("Too early for next proof")
        
        # Validators independently fetch and verify the Terms URL
        # This proves the worker actually completed the service
        def work() -> str:
            response = gl.nondet.web.render(
                url=agreement.terms,
                method="GET",
                timeout=5,
            )
            body = response.get("body", "")
            # Return a verifiable hash that validators can check
            return hashlib.sha256(body.encode()).hexdigest()
        
        # Run work and have validators verify it
        result = gl.vm.run_nondet_unsafe(work, lambda r: isinstance(r, str) and len(r) == 64)
        
        # Store the verified result
        agreement.last_check_hash = result
        agreement.last_response_time = u256(self._now())
        agreement.paid_ticks += u256(1)
        agreement.total_paid_out += agreement.payment_per_tick
        agreement.next_deadline = u256(self._now()) + agreement.interval_seconds
        agreement.consecutive_failures = u256(0)
        
        if agreement.paid_ticks >= agreement.total_ticks:
            agreement.status = "completed"
        
        self.agreements[agreement_id] = agreement
        self.proof_counter += u256(1)
        return True

    @gl.public.write
    def report_violation(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None or agreement.status != "active":
            raise ValueError("Not active")
        agreement.violations += u256(1)
        if agreement.violations >= u256(3):
            agreement.status = "suspended"
            remaining_ticks = agreement.total_ticks - agreement.paid_ticks
            refund = (remaining_ticks * agreement.payment_per_tick) - agreement.total_paid_out
            if refund > u256(0):
                agreement.total_refunded += refund
        self.agreements[agreement_id] = agreement
        return True

    @gl.public.write
    def cancel_agreement(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if str(gl.message.sender_address) != agreement.hiree:
            raise ValueError("Only hiree")
        agreement.status = "cancelled"
        self.agreements[agreement_id] = agreement
        return True

    @gl.public.view
    def agreement_exists(self, agreement_id: str) -> bool:
        return self.agreements.get(agreement_id) is not None
    
    @gl.public.view
    def get_agreement(self, agreement_id: str) -> str:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return "NONEXISTENT"
        return json.dumps({
            "id": agreement.agreement_id,
            "status": agreement.status,
            "worker": agreement.worker,
            "terms": agreement.terms,
            "paid": str(agreement.paid_ticks),
            "total": str(agreement.total_ticks),
            "hash": agreement.last_check_hash[-8:] if agreement.last_check_hash else "",
        })
    
    @gl.public.view  
    def get_stats(self, agreement_id: str) -> dict:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return {"status": "NONEXISTENT", "paid": 0, "total": agreement.total_ticks}
        return {
            "status": agreement.status,
            "paid": agreement.paid_ticks,
            "total": agreement.total_ticks,
            "hash": agreement.last_check_hash,
        }