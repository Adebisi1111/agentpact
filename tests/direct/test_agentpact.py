"""Tests for AgentPact Service Agreement contract."""
import pytest


def test_create_agreement(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test creating a new service agreement."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    aid = contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    assert aid == "SA-001"

    agreement = contract.get_agreement("SA-001")
    assert agreement is not None
    assert agreement.id == "SA-001"
    assert agreement.hiree.lower() == "0x" + direct_alice.hex()
    assert agreement.worker.lower() == "0x" + direct_bob.hex()
    assert agreement.payment_per_tick == 100
    assert agreement.interval_seconds == 300
    assert agreement.total_ticks == 10
    assert agreement.paid_ticks == 0
    assert agreement.status == "active"
    assert agreement.violations == 0


def test_create_agreement_duplicate_id(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test that duplicate agreement IDs are rejected."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    with direct_vm.expect_revert("Agreement ID already exists"):
        direct_vm.sender = direct_alice
        direct_vm.value = 1000
        contract.create_agreement(
            agreement_id="SA-001",
            worker=direct_bob,
            terms="https://httpbin.org/status/200",
            payment_per_tick=100,
            interval_seconds=300,
            total_ticks=10,
            uptime_required=90,
            response_time_required=500,
            penalty_rate=10,
        )


def test_create_agreement_invalid_params(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test that invalid parameters are rejected."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Payment per tick must be positive"):
        direct_vm.value = 1000
        contract.create_agreement(
            agreement_id="SA-001",
            worker=direct_bob,
            terms="https://httpbin.org/status/200",
            payment_per_tick=0,
            interval_seconds=300,
            total_ticks=10,
            uptime_required=90,
            response_time_required=500,
            penalty_rate=10,
        )

    with direct_vm.expect_revert("Interval must be positive"):
        direct_vm.value = 1000
        contract.create_agreement(
            agreement_id="SA-002",
            worker=direct_bob,
            terms="https://httpbin.org/status/200",
            payment_per_tick=100,
            interval_seconds=0,
            total_ticks=10,
            uptime_required=90,
            response_time_required=500,
            penalty_rate=10,
        )

    with direct_vm.expect_revert("Total ticks must be positive"):
        direct_vm.value = 1000
        contract.create_agreement(
            agreement_id="SA-003",
            worker=direct_bob,
            terms="https://httpbin.org/status/200",
            payment_per_tick=100,
            interval_seconds=300,
            total_ticks=0,
            uptime_required=90,
            response_time_required=500,
            penalty_rate=10,
        )


def test_create_agreement_same_hiree_worker(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test that hiree and worker cannot be the same address."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice

    with direct_vm.expect_revert("Worker cannot be the same as hiree"):
        direct_vm.value = 1000
        contract.create_agreement(
            agreement_id="SA-001",
            worker=direct_alice,
            terms="https://httpbin.org/status/200",
            payment_per_tick=100,
            interval_seconds=300,
            total_ticks=10,
            uptime_required=90,
            response_time_required=500,
            penalty_rate=10,
        )


def test_submit_proof_success(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test worker submitting valid proof."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    result = contract.submit_proof(
        agreement_id="SA-001",
        proof_hash="0xabc123",
        status_code=200,
        response_time=100,
        nonce=1,
        signature="0xdef456",
    )

    assert result is True

    agreement = contract.get_agreement("SA-001")
    assert agreement.paid_ticks == 1


def test_submit_proof_wrong_worker(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """Test that only the designated worker can submit proof."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    direct_vm.sender = direct_charlie
    direct_vm.value = 0
    with direct_vm.expect_revert("Only worker can submit proof"):
        contract.submit_proof(
            agreement_id="SA-001",
            proof_hash="0xabc123",
            status_code=200,
            response_time=100,
            signature="0xdef456",
            nonce=1,
        )


def test_submit_proof_replay_protection(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test that replayed nonces are rejected."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    contract.submit_proof(
        agreement_id="SA-001",
        proof_hash="0xabc123",
        status_code=200,
        response_time=100,
        signature="0xdef456",
        nonce=1,
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    with direct_vm.expect_revert("Invalid nonce"):
        contract.submit_proof(
            agreement_id="SA-001",
            proof_hash="0xabc123",
            status_code=200,
            response_time=100,
            signature="0xdef456",
            nonce=1,
        )


def test_submit_proof_invalid_agreement(direct_vm, direct_deploy, direct_alice):
    """Test that submitting to non-existent agreement fails."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 0
    with direct_vm.expect_revert("Agreement not found"):
        contract.submit_proof(
            agreement_id="NONEXISTENT",
            proof_hash="0xabc123",
            status_code=200,
            response_time=100,
            signature="0xdef456",
            nonce=1,
        )


def test_agreement_completion(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test that agreement is marked completed after all payments."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 100
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=1,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    contract.submit_proof(
        agreement_id="SA-001",
        proof_hash="0xabc123",
        status_code=200,
        response_time=100,
        signature="0xdef456",
        nonce=1,
    )

    agreement = contract.get_agreement("SA-001")
    assert agreement.status == "completed"
    assert agreement.paid_ticks == 1


def test_cancel_agreement(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test that hiree can cancel an active agreement."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    direct_vm.sender = direct_alice
    direct_vm.value = 0
    result = contract.cancel_agreement("SA-001")
    assert result is True

    agreement = contract.get_agreement("SA-001")
    assert agreement.status == "cancelled"


def test_cancel_agreement_not_hiree(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    """Test that only hiree can cancel."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    direct_vm.sender = direct_charlie
    direct_vm.value = 0
    with direct_vm.expect_revert("Only hiree can cancel"):
        contract.cancel_agreement("SA-001")


def test_get_nonce(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test nonce tracking."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )

    assert contract.get_nonce("SA-001") == 0

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    contract.submit_proof(
        agreement_id="SA-001",
        proof_hash="0xabc123",
        status_code=200,
        response_time=100,
        signature="0xdef456",
        nonce=1,
    )

    assert contract.get_nonce("SA-001") == 1


def test_submit_proof_inactive_agreement(direct_vm, direct_deploy, direct_alice, direct_bob):
    """Test that submitting to a cancelled agreement fails."""
    contract = direct_deploy("contracts/agentpact_v3.py")

    direct_vm.sender = direct_alice
    direct_vm.value = 1000
    contract.create_agreement(
        agreement_id="SA-001",
        worker=direct_bob,
        terms="https://httpbin.org/status/200",
        payment_per_tick=100,
        interval_seconds=300,
        total_ticks=10,
        uptime_required=90,
        response_time_required=500,
        penalty_rate=10,
    )
    contract.cancel_agreement("SA-001")

    direct_vm.sender = direct_bob
    direct_vm.value = 0
    with direct_vm.expect_revert("Agreement is not active"):
        contract.submit_proof(
            agreement_id="SA-001",
            proof_hash="0xabc123",
            status_code=200,
            response_time=100,
            signature="0xdef456",
            nonce=1,
        )
