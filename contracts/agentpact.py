# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""AgentPact — prediction market on AI agent deliverable quality.

A market cites an agent, a task, the agent's deliverable URL, and explicit
acceptance criteria. Traders stake GEN on YES (the deliverable meets the
criteria) or NO (it does not). Resolution is GenLayer-native: every validator
independently fetches the deliverable, judges it against the criteria with an
LLM, and the network reconciles the verdicts through comparative consensus. No
oracle, no admin outcome setter.

Payout is parimutuel; winners are paid native GEN. Paying an EOA is an EXTERNAL
message, so it goes through the EVM interface (the ghost contract) --
gl.get_contract_at(wallet).emit_transfer() is IC->IC only and silently moves
nothing.
"""

import json

from genlayer import *

# Every submitter-controlled input is capped: a heavy prompt times the round out
# instead of disagreeing, and these are caller-supplied.
MAX_AGENT_CHARS = 100
MAX_TASK_CHARS = 500
MAX_URL_CHARS = 2000
MAX_CRITERIA_CHARS = 1500
MAX_EVIDENCE_CHARS = 4000
MAX_SIDE_CHARS = 4


@gl.evm.contract_interface
class _Payee:
    class View:
        pass

    class Write:
        pass


class AgentPact(gl.Contract):
    market_count: u256

    # market_id -> creator | agent | task | deliverable_url | criteria
    m_creator: TreeMap[str, str]
    m_agent: TreeMap[str, str]
    m_task: TreeMap[str, str]
    m_deliverable: TreeMap[str, str]
    m_criteria: TreeMap[str, str]
    m_status: TreeMap[str, str]   # OPEN | RESOLVED | SETTLED
    m_outcome: TreeMap[str, str]  # YES | NO
    m_pool: TreeMap[str, u256]

    # market_id -> comma-separated unique staker addresses
    m_members: TreeMap[str, str]
    # "market_id:addr" -> JSON {"YES": amt, "NO": amt}, aggregated per side
    m_positions: TreeMap[str, str]
    # "market_id:addr" -> "1" once claimed
    m_claimed: TreeMap[str, str]

    def __init__(self):
        self.market_count = u256(0)

    @gl.public.write
    def createMarket(self, agent: str, task: str, deliverable_url: str,
                     criteria: str) -> str:
        """Create a market on whether an agent's deliverable meets the criteria.

        The deliverable URL is the evidence every validator will fetch; the
        criteria are what counts as acceptable.
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

        sender = str(gl.message.sender_address)
        self.market_count += u256(1)
        mid = f"market-{self.market_count}"
        self.m_creator[mid] = sender
        self.m_agent[mid] = agent
        self.m_task[mid] = task
        self.m_deliverable[mid] = deliverable_url
        self.m_criteria[mid] = criteria
        self.m_status[mid] = "OPEN"
        self.m_outcome[mid] = ""
        self.m_pool[mid] = u256(0)
        self.m_members[mid] = ""
        return mid

    @gl.public.write.payable
    def stake(self, market_id: str, side: str) -> None:
        """Stake GEN on YES or NO. Rejects anything else."""
        side = str(side).strip().upper()[:MAX_SIDE_CHARS]
        if side not in ("YES", "NO"):
            raise gl.vm.UserError("Side must be YES or NO")
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Market not open")
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

        Every validator fetches the market's deliverable URL itself and judges
        it against the criteria. Comparative consensus reconciles their
        verdicts, so the outcome is the network's, not the caller's. If the
        evidence does not settle it, the market stays OPEN for a later attempt.
        """
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN":
            raise gl.vm.UserError("Already resolved")

        agent = self.m_agent.get(market_id, "")
        task = self.m_task.get(market_id, "")
        url = self.m_deliverable.get(market_id, "")
        criteria = self.m_criteria.get(market_id, "")

        def _judge() -> str:
            page = gl.nondet.web.render(url, mode="text")
            # Keep only lines that mention the criteria's key terms. Validators
            # each fetch the deliverable themselves and a raw prefix slice of a
            # large, frequently-edited page differs between them, which starves
            # the equivalence principle of agreement. Filtering to relevant
            # lines makes the judged input stable across fetches.
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
            evidence = "\n".join(hits) if hits else page[:MAX_EVIDENCE_CHARS]

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
            # Check UNKNOWN first: a substring scan would match the "NO" inside
            # "UNKNOWN" and silently resolve an unsettled market against NO.
            if "UNKNOWN" in v:
                return "UNKNOWN"
            if "YES" in v:
                return "YES"
            if "NO" in v:
                return "NO"
            return "UNKNOWN"

        # Comparative returns _judge()'s own value verbatim, which is what we
        # need for a strict YES/NO/UNKNOWN token. (prompt_non_comparative pipes
        # the leader's output through a second LLM template, so the return is
        # prose rather than the bare verdict.) Agreement therefore depends on
        # the judged input being stable across validators -- hence the filtered
        # evidence above rather than a raw page slice.
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
    def settle(self, market_id: str) -> None:
        """Lock the resolved outcome so claims can open."""
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "RESOLVED":
            raise gl.vm.UserError("Not resolved")
        self.m_status[market_id] = "SETTLED"

    def _payout_for(self, market_id: str, who: str) -> int:
        """Parimutuel: winning_stake * total_pool // winning_pool."""
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
        """Pay the winner their parimutuel share in native GEN, once."""
        if self.m_creator.get(market_id, None) is None:
            raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "SETTLED":
            raise gl.vm.UserError("Not settled")
        sender = str(gl.message.sender_address)
        if self.m_claimed.get(f"{market_id}:{sender}", "") == "1":
            raise gl.vm.UserError("Already claimed")
        payout = self._payout_for(market_id, sender)
        if payout <= 0:
            raise gl.vm.UserError("No winning stake")
        # Mark before transferring; a failed external message reverts the whole call.
        self.m_claimed[f"{market_id}:{sender}"] = "1"
        _Payee(gl.message.sender_address).emit_transfer(value=u256(payout))
        return u256(payout)

    @gl.public.view
    def getMarket(self, market_id: str) -> dict:
        """Full market record as JSON -- never a delimited string, so a task
        containing `|` cannot shift the fields that follow it."""
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
            "status": self.m_status.get(market_id, ""),
            "outcome": self.m_outcome.get(market_id, ""),
            "pool": int(self.m_pool.get(market_id, u256(0))),
            "stakers": len(members),
        }

    @gl.public.view
    def getPosition(self, market_id: str, user: str) -> dict:
        """One wallet's position in a market."""
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
        """Page the market set; `limit` is clamped to 20."""
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
        if self.m_status.get(market_id, "") != "SETTLED":
            return u256(0)
        return u256(self._payout_for(market_id, str(user)))

    @gl.public.view
    def isClaimed(self, market_id: str, user: str) -> bool:
        return self.m_claimed.get(f"{market_id}:{str(user)}", "") == "1"

    @gl.public.view
    def getConfig(self) -> u256:
        return self.market_count
