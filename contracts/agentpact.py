# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""AgentPact — prediction market on AI agent deliverable quality.

A market cites an agent, a task, the agent's deliverable URL, and explicit
acceptance criteria, plus a deadline. Traders stake GEN on YES (the deliverable
meets the criteria) or NO (it does not). Staking closes when the deadline
passes; resolution opens only after the deadline.

The deliverable is bound to a stable content version: at creation time every
validator fetches the deliverable and records a content hash. At resolution
they fetch again and the hash must match — if the deliverable changed, the
round fails closed rather than judging a moving target.

Resolution is GenLayer-native: every validator independently fetches the
deliverable, judges it against the criteria with an LLM, and the network
reconciles the verdicts through comparative consensus. No oracle, no admin
outcome setter.

Terminal cases:
  - RESOLVED YES/NO with stakes on the winning side  -> SETTLED, parimutuel payout
  - RESOLVED YES/NO with NO stakes on the winning side -> VOID, everyone refunded
  - UNKNOWN (evidence does not settle it)            -> stays OPEN, retryable
  - Never resolved past deadline + 30d grace          -> VOID, everyone refunded

Payout is parimutuel; winners are paid native GEN. Paying an EOA is an EXTERNAL
message, so it goes through the EVM interface (the ghost contract) --
gl.get_contract_at(wallet).emit_transfer() is IC->IC only and silently moves
nothing.
"""

import json
import hashlib
from datetime import datetime, timezone

from genlayer import *

MAX_AGENT_CHARS = 100
MAX_TASK_CHARS = 500
MAX_URL_CHARS = 2000
MAX_CRITERIA_CHARS = 1500
MAX_EVIDENCE_CHARS = 4000
MAX_SIDE_CHARS = 4

VOID_GRACE_SECONDS = 30 * 24 * 3600


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass


def _now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


class AgentPact(gl.Contract):
    market_count: u256

    m_creator: TreeMap[str, str]
    m_agent: TreeMap[str, str]
    m_task: TreeMap[str, str]
    m_deliverable: TreeMap[str, str]
    m_criteria: TreeMap[str, str]
    m_deadline: TreeMap[str, u256]
    m_deliverable_hash: TreeMap[str, str]
    m_status: TreeMap[str, str]       # OPEN | RESOLVED | SETTLED | VOID
    m_outcome: TreeMap[str, str]      # YES | NO | (empty)
    m_pool: TreeMap[str, u256]

    m_members: TreeMap[str, str]
    m_positions: TreeMap[str, str]
    m_claimed: TreeMap[str, str]

    def __init__(self):
        self.market_count = u256(0)

    @gl.public.write
    def createMarket(self, agent: str, task: str, deliverable_url: str,
                     criteria: str, deadline: u256) -> str:
        """Create a market. Deadline is unix seconds, must be in the future.

        At creation every validator fetches the deliverable and records a
        content hash, binding the market to that version of the evidence.
        """
        agent = str(agent).strip()
        if not agent:
            raise gl.vm.UserError("Agent name required")
        if len(agent) > MAX_AGENT_CHARS:
            raise gl.vm.UserError(f"Agent name must be {MAX_AGENT_CHARS} characters or fewer")
        task = str(task).strip()
        if not task:
            raise gl.vm.UserError("Task required")
        if len(task) > MAX_TASK_CHARS:
            raise gl.vm.UserError(f"Task must be {MAX_TASK_CHARS} characters or fewer")
        deliverable_url = str(deliverable_url).strip()
        if not deliverable_url.startswith(("http://", "https://")):
            raise gl.vm.UserError("Deliverable URL must be http(s)")
        if len(deliverable_url) > MAX_URL_CHARS:
            raise gl.vm.UserError(f"Deliverable URL must be {MAX_URL_CHARS} characters or fewer")
        criteria = str(criteria).strip()
        if not criteria:
            raise gl.vm.UserError("Acceptance criteria required")
        if len(criteria) > MAX_CRITERIA_CHARS:
            raise gl.vm.UserError(f"Criteria must be {MAX_CRITERIA_CHARS} characters or fewer")
        if int(deadline) <= _now():
            raise gl.vm.UserError("Deadline must be in the future")

        # Bind deliverable to a stable content version: fetch and hash.
        def _hash_deliverable() -> str:
            page = gl.nondet.web.render(deliverable_url, mode="text")
            return hashlib.sha256(str(page).encode()).hexdigest()

        content_hash = gl.eq_principle.strict_eq(_hash_deliverable)

        sender = str(gl.message.sender_address)
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        self.m_creator[mid] = sender
        self.m_agent[mid] = agent
        self.m_task[mid] = task
        self.m_deliverable[mid] = deliverable_url
        self.m_criteria[mid] = criteria
        self.m_deadline[mid] = deadline
        self.m_deliverable_hash[mid] = content_hash
        self.m_status[mid] = "OPEN"
        self.m_outcome[mid] = ""
        self.m_pool[mid] = u256(0)
        self.m_members[mid] = ""
        return mid

    @gl.public.write.payable
    def stake(self, market_id: str, side: str) -> None:
        """Stake GEN on YES or NO. Staking closes when the deadline passes."""
        side = str(side).strip().upper()[:MAX_SIDE_CHARS]
        if side not in ("YES", "NO"):
            raise gl.vm.UserError("Side must be YES or NO")
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Market not open")
        deadline = int(self.m_deadline.get(market_id, u256(0)))
        if _now() >= deadline:
            raise gl.vm.UserError("Staking closed: deadline has passed")
        amt = gl.message.value
        if amt <= u256(0):
            raise gl.vm.UserError("Must send GEN")

        sender = str(gl.message.sender_address)
        self.m_pool[market_id] = u256(int(self.m_pool.get(market_id, u256(0))) + int(amt))

        key = f"{market_id}:{sender}"
        pos = json.loads(self.m_positions.get(key, "{}"))
        pos[side] = int(pos.get(side, 0)) + int(amt)
        self.m_positions[key] = json.dumps(pos)

        members = self.m_members.get(market_id, "")
        if sender not in members.split(","):
            self.m_members[market_id] = (members + "," + sender) if members else sender

    @gl.public.write
    def resolve(self, market_id: str) -> str:
        """Resolve from the deliverable through validator consensus.

        Resolution only opens after the deadline. The deliverable content hash
        must match the version bound at creation; if it changed, resolution
        fails closed. If the evidence does not settle it (UNKNOWN), the market
        stays OPEN for a later attempt.
        """
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Already resolved")

        deadline = int(self.m_deadline.get(market_id, u256(0)))
        if _now() < deadline:
            raise gl.vm.UserError("Resolution not open: deadline has not passed")

        agent = self.m_agent.get(market_id, "")
        task = self.m_task.get(market_id, "")
        url = self.m_deliverable.get(market_id, "")
        criteria = self.m_criteria.get(market_id, "")
        stored_hash = self.m_deliverable_hash.get(market_id, "")

        # Evidence-version enforcement: re-hash the deliverable; if it changed, fail closed.
        def _hash_at_resolve() -> str:
            page = gl.nondet.web.render(url, mode="text")
            return hashlib.sha256(str(page).encode()).hexdigest()

        resolve_hash = gl.eq_principle.strict_eq(_hash_at_resolve)
        if str(resolve_hash) != stored_hash:
            raise gl.vm.UserError("Deliverable content changed since market creation")

        def _judge() -> str:
            page = gl.nondet.web.render(url, mode="text")
            terms = [w.strip("?$,.:;\"'()").lower()
                     for w in (task + " " + criteria).split() if len(w) > 3]
            hits = []
            for line in page.splitlines():
                ls = line.strip()
                if len(ls) < 20:
                    continue
                low = ls.lower()
                if any(t in low for t in terms):
                    hits.append(ls)
                if len(hits) >= 60:
                    break
            evidence = "\n".join(hits) if hits else str(page)[:MAX_EVIDENCE_CHARS]

            verdict = gl.nondet.exec_prompt(
                "You are evaluating an AI agent's deliverable against explicit "
                "acceptance criteria.\n"
                f"AGENT: {agent}\n"
                f"TASK: {task}\n"
                f"ACCEPTANCE CRITERIA:\n{criteria}\n\n"
                f"DELIVERABLE:\n{evidence[:MAX_EVIDENCE_CHARS]}\n\n"
                "Answer with exactly one word: YES if the deliverable meets the "
                "criteria, NO if it does not, or UNKNOWN if the evidence does "
                "not settle it. One word only."
            )
            v = str(verdict).strip().upper()
            if "UNKNOWN" in v:
                return "UNKNOWN"
            if "YES" in v:
                return "YES"
            if "NO" in v:
                return "NO"
            return "UNKNOWN"

        outcome = gl.eq_principle.prompt_comparative(
            _judge,
            "Both must give the same one-word verdict (YES, NO, or UNKNOWN) "
            f"for the deliverable of agent {agent} on task: {task}",
        )

        decided = str(outcome).strip().upper()
        if decided not in ("YES", "NO"):
            raise gl.vm.UserError("Deliverable does not settle this market yet")

        self.m_status[market_id] = "RESOLVED"
        self.m_outcome[market_id] = decided
        return decided

    @gl.public.write
    def settle(self, market_id: str) -> str:
        """Lock the resolved outcome so claims can open.

        If the winning side drew no stake, the market is VOID instead and
        every staker takes their own stake back.
        """
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "RESOLVED":
            raise gl.vm.UserError("Not resolved")
        outcome = self.m_outcome.get(market_id, "")
        winning_pool = 0
        members = self.m_members.get(market_id, "")
        for addr in members.split(","):
            if not addr:
                continue
            pos = json.loads(self.m_positions.get(f"{market_id}:{addr}", "{}"))
            winning_pool += int(pos.get(outcome, 0))
        if winning_pool <= 0:
            self.m_status[market_id] = "VOID"
            return "VOID"
        self.m_status[market_id] = "SETTLED"
        return "SETTLED"

    @gl.public.write
    def void(self, market_id: str) -> str:
        """Release a market the validators never resolved, and refund stakers.

        Only reachable once the deadline is VOID_GRACE_SECONDS past and the
        market is still OPEN. Cannot escape a verdict: resolved markets are
        not OPEN.
        """
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Not open")
        deadline = int(self.m_deadline.get(market_id, u256(0)))
        if _now() <= deadline + VOID_GRACE_SECONDS:
            raise gl.vm.UserError("Grace period has not passed")
        self.m_status[market_id] = "VOID"
        return "VOID"

    def _stake_of(self, market_id: str, who: str) -> int:
        key = f"{market_id}:{who}"
        pos = json.loads(self.m_positions.get(key, "{}"))
        return int(pos.get("YES", 0)) + int(pos.get("NO", 0))

    def _payout_for(self, market_id: str, who: str) -> int:
        status = self.m_status.get(market_id, "")
        if status == "VOID":
            return self._stake_of(market_id, who)
        if status != "SETTLED":
            return 0
        outcome = self.m_outcome.get(market_id, "")
        if outcome not in ("YES", "NO"):
            return 0
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        winning_pool = 0
        user_stake = 0
        members = self.m_members.get(market_id, "")
        for addr in members.split(","):
            if not addr:
                continue
            pos = json.loads(self.m_positions.get(f"{market_id}:{addr}", "{}"))
            stake = int(pos.get(outcome, 0))
            winning_pool += stake
            if addr == who:
                user_stake += stake
        if user_stake <= 0 or winning_pool <= 0:
            return 0
        return (user_stake * total_pool) // winning_pool

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        """Pay the winner their parimutuel share, or refund on VOID, once."""
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") not in ("SETTLED", "VOID"):
            raise gl.vm.UserError("Not settled")
        sender = str(gl.message.sender_address)
        key = f"{market_id}:{sender}"
        if self.m_claimed.get(key, "") == "1":
            raise gl.vm.UserError("Already claimed")
        payout = self._payout_for(market_id, sender)
        if payout <= 0:
            raise gl.vm.UserError("Nothing to claim")
        if int(self.balance) < payout:
            raise gl.vm.UserError("Contract balance is short of this payout")
        self.m_claimed[key] = "1"
        _Payee(gl.message.sender_address).emit_transfer(value=u256(payout))
        return u256(payout)

    @gl.public.view
    def getMarket(self, market_id: str) -> dict:
        if self.m_creator.get(market_id, None) is None:
            return {"exists": False}
        members = [a for a in self.m_members.get(market_id, "").split(",") if a]
        return {
            "exists": True,
            "market_id": market_id,
            "creator": self.m_creator.get(market_id, ""),
            "agent": self.m_agent.get(market_id, ""),
            "task": self.m_task.get(market_id, ""),
            "deliverable_url": self.m_deliverable.get(market_id, ""),
            "criteria": self.m_criteria.get(market_id, ""),
            "deadline": int(self.m_deadline.get(market_id, u256(0))),
            "deliverable_hash": self.m_deliverable_hash.get(market_id, ""),
            "status": self.m_status.get(market_id, ""),
            "outcome": self.m_outcome.get(market_id, ""),
            "pool": int(self.m_pool.get(market_id, u256(0))),
            "stakers": len(members),
        }

    @gl.public.view
    def getPosition(self, market_id: str, user: str) -> dict:
        key = f"{market_id}:{str(user)}"
        try:
            pos = json.loads(self.m_positions.get(key, "{}"))
        except Exception:
            pos = {}
        return {
            "yes": int(pos.get("YES", 0)),
            "no": int(pos.get("NO", 0)),
            "claimed": self.m_claimed.get(key, "") == "1",
        }

    @gl.public.view
    def listMarkets(self, offset: u256, limit: u256) -> dict:
        start = int(offset)
        total = int(self.market_count)
        count = min(int(limit), 20)
        out = []
        for i in range(start, min(start + count, total)):
            mid = f"market-{i + 1}"
            if self.m_creator.get(mid, None) is None:
                continue
            out.append({
                "market_id": mid,
                "agent": self.m_agent.get(mid, ""),
                "task": self.m_task.get(mid, ""),
                "status": self.m_status.get(mid, ""),
                "outcome": self.m_outcome.get(mid, ""),
                "pool": int(self.m_pool.get(mid, u256(0))),
            })
        return {"offset": start, "total": total, "markets": out}

    @gl.public.view
    def previewPayout(self, market_id: str, user: str) -> u256:
        if self.m_status.get(market_id, "") not in ("SETTLED", "VOID"):
            return u256(0)
        return u256(self._payout_for(market_id, str(user)))

    @gl.public.view
    def isClaimed(self, market_id: str, user: str) -> bool:
        return self.m_claimed.get(f"{market_id}:{str(user)}", "") == "1"

    @gl.public.view
    def getDeliverableHash(self, market_id: str) -> str:
        return self.m_deliverable_hash.get(market_id, "")

    @gl.public.view
    def contractBalance(self) -> str:
        return str(int(self.balance))

    @gl.public.view
    def getConfig(self) -> u256:
        return self.market_count

    @gl.public.view
    def now(self) -> str:
        return str(_now())
