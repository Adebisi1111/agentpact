# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import genlayer as gl
from genlayer.types import *
from genlayer.py.types import Address


class AgentPact(gl.Contract):
    agreements: TreeMap[str, str]
    agreement_counter: u256
    proof_counter: u256

    def __init__(self):
        self.agreements = TreeMap[str, str]()
        self.agreement_counter = u256(0)
        self.proof_counter = u256(0)

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
        import json
        agreement_json = json.dumps({
            "id": agreement_id,
            "hiree": gl.message.sender_address.as_hex,
            "worker": Address(worker).as_hex,
            "terms": terms,
            "payment_per_tick": int(payment_per_tick),
            "interval_seconds": int(interval_seconds),
            "next_deadline": 0,
            "total_ticks": int(total_ticks),
            "paid_ticks": 0,
            "status": "pending",
            "violations": 0,
            "last_proof_hash": "",
            "last_response_time": 0,
            "consecutive_failures": 0,
            "uptime_required": int(uptime_required),
            "response_time_required": int(response_time_required),
            "penalty_rate": int(penalty_rate),
            "total_deposited": 0,
            "total_paid_out": 0,
        })
        self.agreements[agreement_id] = agreement_json
        self.agreement_counter += u256(1)
        return agreement_id

    @gl.public.write.payable
    def fund_agreement(self, agreement_id: str) -> str:
        agreement_str = self.agreements.get(agreement_id)
        if agreement_str is None:
            raise ValueError("Agreement not found")
        import json
        agreement = json.loads(agreement_str)
        if agreement["status"] != "pending":
            raise ValueError("Can only fund pending")
        total = agreement["payment_per_tick"] * agreement["total_ticks"]
        if gl.message.value < total:
            raise ValueError("Insufficient escrow")
        agreement["total_deposited"] = int(gl.message.value)
        agreement["status"] = "active"
        agreement["next_deadline"] = self._now() + agreement["interval_seconds"]
        self.agreements[agreement_id] = json.dumps(agreement)
        return "Funded"

    def _now(self) -> int:
        import datetime
        return int(datetime.datetime.now(datetime.timezone.utc).timestamp())

    @gl.public.write
    def submit_proof(self, agreement_id: str) -> bool:
        agreement_str = self.agreements.get(agreement_id)
        if agreement_str is None:
            raise ValueError("Not found")
        import json
        agreement = json.loads(agreement_str)
        if agreement["status"] != "active":
            raise ValueError("Not active")
        if self._now() < agreement["next_deadline"]:
            raise ValueError("Too early")

        def get_proof() -> dict:
            import hashlib
            response = gl.nondet.web.render(
                url=agreement["terms"],
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
        agreement["last_proof_hash"] = result["proof_hash"]
        agreement["paid_ticks"] += 1
        agreement["consecutive_failures"] = 0
        agreement["total_paid_out"] += agreement["payment_per_tick"]
        agreement["next_deadline"] = self._now() + agreement["interval_seconds"]
        if agreement["paid_ticks"] >= agreement["total_ticks"]:
            agreement["status"] = "completed"
        self.agreements[agreement_id] = json.dumps(agreement)
        self.proof_counter += u256(1)
        return True

    @gl.public.write
    def report_violation(self, agreement_id: str) -> bool:
        agreement_str = self.agreements.get(agreement_id)
        if agreement_str is None:
            raise ValueError("Not found")
        import json
        agreement = json.loads(agreement_str)
        if agreement["status"] != "active":
            raise ValueError("Not active")
        agreement["violations"] += 1
        agreement["consecutive_failures"] += 1
        if agreement["consecutive_failures"] >= 3:
            agreement["status"] = "suspended"
        self.agreements[agreement_id] = json.dumps(agreement)
        return True

    @gl.public.write
    def cancel_agreement(self, agreement_id: str) -> bool:
        agreement_str = self.agreements.get(agreement_id)
        if agreement_str is None:
            raise ValueError("Not found")
        import json
        agreement = json.loads(agreement_str)
        if str(gl.message.sender_address) != agreement["hiree"]:
            raise ValueError("Only hiree")
        agreement["status"] = "cancelled"
        self.agreements[agreement_id] = json.dumps(agreement)
        return True

    @gl.public.view
    def get_agreement_json(self, agreement_id: str) -> str:
        return self.agreements.get(agreement_id, '{"error":"not found"}')

    @gl.public.view
    def get_stats(self) -> str:
        import json
        return json.dumps({
            "total_agreements": int(self.agreement_counter),
            "total_proofs": int(self.proof_counter),
        })
