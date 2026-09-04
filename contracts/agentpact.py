# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

"""
AgentPact - Continuously Verifiable Service Agreements for AI Agents
"""

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


class AgentPact(gl.Contract):
    agreements: TreeMap[str, ServiceAgreement]
    nonces: TreeMap[str, u256]
    
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
            raise ValueError("Agreement ID already exists")
        
        if payment_per_tick <= 0:
            raise ValueError("Payment per tick must be positive")
        
        if interval_seconds <= 0:
            raise ValueError("Interval must be positive")
        
        if total_ticks <= 0:
            raise ValueError("Total ticks must be positive")
        
        if worker == gl.message.sender_address.as_hex:
            raise ValueError("Worker cannot be the same as hiree")
        
        agreement = ServiceAgreement(
            id=agreement_id,
            hiree=gl.message.sender_address.as_hex,
            worker=worker,
            terms=terms,
            payment_per_tick=payment_per_tick,
            interval_seconds=interval_seconds,
            next_deadline=u256(0),
            total_ticks=total_ticks,
            paid_ticks=u256(0),
            status="active",
            violations=u256(0),
        )
        
        self.agreements[agreement_id] = agreement
        self.nonces[agreement_id] = u256(0)
        
        return agreement_id
    
    @gl.public.write
    def submit_proof(
        self,
        agreement_id: str,
        proof_url: str,
        nonce: u256,
    ) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Agreement not found")
        
        if agreement.status != "active":
            raise ValueError("Agreement is not active")
        
        if gl.message.sender_address.as_hex != agreement.worker:
            raise ValueError("Only worker can submit proof")
        
        if nonce <= self.nonces[agreement_id]:
            raise ValueError("Invalid nonce")
        self.nonces[agreement_id] = nonce
        
        # Verify proof
        is_valid = self._verify_proof(proof_url)
        
        if is_valid:
            agreement.paid_ticks += u256(1)
            
            if agreement.paid_ticks >= agreement.total_ticks:
                agreement.status = "completed"
            
            self.agreements[agreement_id] = agreement
            return True
        else:
            agreement.violations += u256(1)
            self.agreements[agreement_id] = agreement
            return False
    
    def _verify_proof(self, proof_url: str) -> bool:
        """Verify submitted proof using equivalence principle."""
        def leader() -> dict:
            result = gl.nondet.web.render(proof_url, mode="text")
            return {"valid": len(result) > 0}
        
        def validator(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            return leader()["valid"] == leader_result.calldata["valid"]
        
        result = gl.vm.run_nondet_unsafe(leader, validator)
        return result["valid"]
    
    @gl.public.write
    def cancel_agreement(self, agreement_id: str) -> bool:
        agreement = self.agreements.get(agreement_id)
        if agreement is None:
            raise ValueError("Agreement not found")
        
        if gl.message.sender_address.as_hex != agreement.hiree:
            raise ValueError("Only hiree can cancel")
        
        if agreement.status != "active":
            raise ValueError("Can only cancel active agreements")
        
        agreement.status = "cancelled"
        self.agreements[agreement_id] = agreement
        return True
    
    @gl.public.view
    def get_agreement(self, agreement_id: str) -> Optional[ServiceAgreement]:
        return self.agreements.get(agreement_id)
    
    @gl.public.view
    def get_nonce(self, agreement_id: str) -> u256:
        return self.nonces.get(agreement_id, u256(0))
