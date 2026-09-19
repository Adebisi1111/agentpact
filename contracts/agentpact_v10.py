# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *
from genlayer.py.types import Address
from dataclasses import dataclass
from typing import Optional


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
    last_check_status: str
    last_response_time: u256
    consecutive_failures: u256
    uptime_required: u256
    response_time_required: u256
    penalty_rate: u256
    total_deposited: u256
    total_paid_out: u256
    total_refunded: u256
    total_penalties: u256


class AgentPactV10(gl.Contract):
    agreements: TreeMap[str, ServiceAgreement]
    nonces: TreeMap[str, u256]
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
            last_check_status="",
            last_response_time=u256(0),
            consecutive_failures=u256(0),
            uptime_required=uptime_required,
            response_time_required=response_time_required,
            penalty_rate=penalty_rate,
            total_deposited=u256(0),
            total_paid_out=u256(0),
            total_refunded=u256(0),
            total_penalties=u256(0),
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
            raise ValueError("Can only fund pending agreements")
        
        total_escrow = agreement.payment_per_tick * agreement.total_ticks
        
        if gl.message.value < total_escrow:
            raise ValueError(f"Insufficient escrow. Need {total_escrow}, got {gl.message.value}")
        
        agreement.total_deposited = u256(gl.message.value)
        agreement.status = "active"
        agreement.next_deadline = u256(self._now()) + agreement.interval_seconds
        
        self.agreements[agreement_id] = agreement
        return f"Funded with {gl.message.value} GEN"

    def _now(self) -> int:
        import datetime
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    @gl.public.write
    def submit_proof(self, agreement_id: str, proof_hash: str, response_time: u256) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Agreement not found")
        
        if agreement.status != "active":
            raise ValueError("Agreement is not active")
        
        if proof_hash == "":
            raise ValueError("Proof hash cannot be empty")
        
        agreement.last_proof_hash = proof_hash
        agreement.last_response_time = response_time
        agreement.last_check_status = "passed"
        agreement.paid_ticks += u256(1)
        agreement.consecutive_failures = u256(0)
        
        payment_amount = agreement.payment_per_tick
        agreement.total_paid_out += payment_amount
        agreement.next_deadline = u256(self._now()) + agreement.interval_seconds
        
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
        
        agreement.last_check_status = "failed"
        agreement.violations += u256(1)
        agreement.consecutive_failures += u256(1)
        
        penalty = (agreement.payment_per_tick * agreement.penalty_rate) / u256(100)
        agreement.total_penalties += penalty
        
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
            raise ValueError("Only hiree can cancel")
        
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
            "payment_per_tick": str(agreement.payment_per_tick),
            "total_ticks": str(agreement.total_ticks),
            "paid_ticks": str(agreement.paid_ticks),
            "status": agreement.status,
            "violations": str(agreement.violations),
            "last_proof_hash": agreement.last_proof_hash,
            "consecutive_failures": str(agreement.consecutive_failures),
        })

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_agreements": str(self.agreement_counter),
            "total_proofs": str(self.proof_counter),
        })

    @gl.public.view
    def get_agreement(self, agreement_id: str) -> Optional[ServiceAgreement]:
        return self.agreements.get(agreement_id)
