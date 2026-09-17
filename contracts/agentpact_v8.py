# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

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
    def submit_proof(self, agreement_id: str, proof_hash: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None or agreement.status != "active":
            raise ValueError("Not active")
        agreement.last_proof_hash = proof_hash
        agreement.paid_ticks += u256(1)
        agreement.total_paid_out += agreement.payment_per_tick
        import datetime
        agreement.next_deadline = u256(int(datetime.datetime.now(datetime.timezone.utc).timestamp())) + agreement.interval_seconds
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
    def get_agreement(self, agreement_id: str) -> Optional[ServiceAgreement]:
        return self.agreements.get(agreement_id)
