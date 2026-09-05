# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
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


class AgentPact(gl.Contract):
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
        
        if interval_seconds <= 0:
            raise ValueError("Interval must be positive")
        
        if total_ticks <= 0:
            raise ValueError("Total ticks must be positive")
        
        if worker == str(gl.message.sender_address):
            raise ValueError("Worker cannot be the same as hiree")
        
        # Calculate total escrow needed
        total_escrow = payment_per_tick * total_ticks
        
        # Check if hiree sent enough ETH for escrow
        if gl.message.value < total_escrow:
            raise ValueError(f"Insufficient escrow. Need {total_escrow}, got {gl.message.value}")
        
        agreement = ServiceAgreement(
            id=agreement_id,
            hiree=str(gl.message.sender_address),
            worker=str(worker),
            terms=terms,
            payment_per_tick=payment_per_tick,
            interval_seconds=interval_seconds,
            next_deadline=u256(0),
            total_ticks=total_ticks,
            paid_ticks=u256(0),
            status="active",
            violations=u256(0),
            last_proof_hash="",
            last_check_status="none",
            last_response_time=u256(0),
            consecutive_failures=u256(0),
            uptime_required=uptime_required,
            response_time_required=response_time_required,
            penalty_rate=penalty_rate,
            total_deposited=total_escrow,
            total_paid_out=u256(0),
            total_refunded=u256(0),
            total_penalties=u256(0),
        )
        
        self.agreements[agreement_id] = agreement
        self.nonces[agreement_id] = u256(0)
        self.agreement_counter += u256(1)
        
        return agreement_id
    
    @gl.public.write
    def submit_proof(
        self,
        agreement_id: str,
        proof_hash: str,
        status_code: u256,
        response_time: u256,
        nonce: u256,
        signature: str,
    ) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Agreement not found")
        
        if agreement.status != "active":
            raise ValueError("Agreement is not active")
        
        if str(gl.message.sender_address) != agreement.worker:
            raise ValueError("Only worker can submit proof")
        
        if nonce <= self.nonces[agreement_id]:
            raise ValueError("Invalid nonce")
        self.nonces[agreement_id] = nonce
        
        agreement.last_proof_hash = proof_hash
        agreement.last_response_time = response_time
        
        # Verify signature (simplified - in production use ecrecover)
        expected_message = f"proof:{agreement_id}:{proof_hash}:{nonce}"
        
        # Check if proof meets requirements
        is_valid = status_code == u256(200) and response_time <= agreement.response_time_required
        
        if is_valid:
            agreement.last_check_status = "success"
            agreement.paid_ticks += u256(1)
            agreement.consecutive_failures = u256(0)
            self.proof_counter += u256(1)
            
            # Transfer payment to worker
            payment_amount = agreement.payment_per_tick
            agreement.total_paid_out += payment_amount
            
            # Send ETH to worker
            worker_addr = Address(agreement.worker)
            gl.transaction(worker_addr, value=payment_amount)
            
            # Check if uptime requirement is still met
            total_checks = agreement.paid_ticks + agreement.violations
            current_uptime = (agreement.paid_ticks * u256(100)) / total_checks
            
            if current_uptime < agreement.uptime_required:
                agreement.status = "suspended"
            
            # Check if all ticks paid
            if agreement.paid_ticks >= agreement.total_ticks:
                agreement.status = "completed"
                
                # Refund excess escrow
                excess = agreement.total_deposited - agreement.total_paid_out - agreement.total_penalties
                if excess > u256(0):
                    hiree_addr = Address(agreement.hiree)
                    gl.transaction(hiree_addr, value=excess)
                    agreement.total_refunded += excess
        else:
            agreement.last_check_status = "failed"
            agreement.violations += u256(1)
            agreement.consecutive_failures += u256(1)
            
            # Calculate penalty
            penalty = (agreement.payment_per_tick * agreement.penalty_rate) / u256(100)
            agreement.total_penalties += penalty
            
            # Refund penalty to hiree
            if penalty > u256(0):
                hiree_addr = Address(agreement.hiree)
                gl.transaction(hiree_addr, value=penalty)
            
            # Suspend after 3 consecutive failures
            if agreement.consecutive_failures >= u256(3):
                agreement.status = "suspended"
                
                # Refund remaining escrow to hiree
                remaining_ticks = agreement.total_ticks - agreement.paid_ticks
                refund = (remaining_ticks * agreement.payment_per_tick) - agreement.total_penalties
                if refund > u256(0):
                    hiree_addr = Address(agreement.hiree)
                    gl.transaction(hiree_addr, value=refund)
                    agreement.total_refunded += refund
        
        self.agreements[agreement_id] = agreement
        return True
    
    @gl.public.write
    def cancel_agreement(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Agreement not found")
        
        if str(gl.message.sender_address) != agreement.hiree:
            raise ValueError("Only hiree can cancel")
        
        if agreement.status != "active":
            raise ValueError("Can only cancel active agreements")
        
        # Calculate refund: unused ticks minus penalties
        remaining_ticks = agreement.total_ticks - agreement.paid_ticks
        refund_amount = (remaining_ticks * agreement.payment_per_tick) - agreement.total_penalties
        
        agreement.status = "cancelled"
        agreement.total_refunded += refund_amount
        
        # Refund to hiree
        if refund_amount > u256(0):
            hiree_addr = Address(agreement.hiree)
            gl.transaction(hiree_addr, value=refund_amount)
        
        self.agreements[agreement_id] = agreement
        return True
    
    @gl.public.view
    def get_agreement(self, agreement_id: str) -> Optional[ServiceAgreement]:
        return self.agreements.get(agreement_id)
    
    @gl.public.view
    def get_nonce(self, agreement_id: str) -> u256:
        return self.nonces.get(agreement_id, u256(0))
    
    @gl.public.view
    def get_stats(self) -> dict:
        return {
            "total_agreements": self.agreement_counter,
            "total_proofs": self.proof_counter,
        }
    
    @gl.public.view
    def get_uptime_percentage(self, agreement_id: str) -> u256:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            return u256(0)
        
        total_checks = agreement.paid_ticks + agreement.violations
        if total_checks == u256(0):
            return u256(100)
        
        uptime = (agreement.paid_ticks * u256(100)) / total_checks
        return uptime
    
    @gl.public.view
    def get_contract_balance(self) -> u256:
        return gl.contract_balance
