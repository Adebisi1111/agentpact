// GenLayer contract interaction for AgentPact
// AgentPact contract: 0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04 (Bradbury)

import { createClient, createAccount, WalletClient } from 'viem';
import { publicActions } from 'viem/chains';
import { useEffect, useState, createContext, useContext, ReactNode } from 'react';

// GenLayer network config
export const AGENTPACT_CONTRACT = '0x405CF4619e4692849b20273cd68657618fB01d99';

// GenLayer JS client setup (Bradbury testnet)
const BRADBURY_RPC = 'https://rpc-bradbury.genlayer.com';

// Simple storage for contract client
let contractClient: any = null;

export function getContractClient() {
  return contractClient;
}

export function setContractClient(client: any) {
  contractClient = client;
}

export interface Market {
  market_id: string;
  agent: string;
  task: string;
  deliverable_url: string;
  criteria: string;
  status: string;
  outcome: string;
  pool: number;
  stakers: number;
}

export interface MarketRecord {
  exists: boolean;
  market_id: string;
  agent: string;
  task: string;
  deliverable_url: string;
  criteria: string;
  status: string;
  outcome: string;
  pool: number;
  stakers: number;
}

export function createMarket(
  agent: string,
  task: string,
  deliverable_url: string,
  criteria: string,
  walletClient: any
) {
  return new Promise(async (resolve, reject) => {
    try {
      // Create ABI for the contract
      const abi = getContractAbi();
      const client = createWalletClient({
        chain: { id: 'bradbury' },
        transport: 'browserWebSocket',
      });
      // Deploy using genlayer-js
      const { deployContract } = await import('genlayer-js');
      const { testnetBradbury } = await import('genlayer-js/chains');
      const genlayerClient = createClient({ chain: testnetBradbury, account: walletClient.account });
      
      const hash = await genlayerClient.deployContract({
        code: readContractSource(),
        args: [],
        value: 0n,
        gasLimit: 5000000n,
      });
      const receipt = await genlayerClient.waitForTransactionReceipt({ hash, retries: 120, interval: 5000 });
      resolve({ txHash: hash, receipt });
    } catch (error) {
      reject(error);
    }
  });
}

function getContractAbi() {
  // AgentPact contract ABI
  return [
    // Views
    { type: 'function', name: 'getConfig', stateMutability: ['view'], inputs: [], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'getMarket', stateMutability: ['view'], inputs: [{ type: 'string' }], outputs: [{ type: 'tuple', components: [
      { type: 'bool', name: 'exists' },
      { type: 'string', name: 'market_id' },
      { type: 'string', name: 'agent' },
      { type: 'string', name: 'task' },
      { type: 'string', name: 'deliverable_url' },
      { type: 'string', name: 'criteria' },
      { type: 'string', name: 'status' },
      { type: 'string', name: 'outcome' },
      { type: 'uint256', name: 'pool' },
      { type: 'uint256', name: 'stakers' }
    ]}] },
    { type: 'function', name: 'getPosition', stateMutability: ['view'], inputs: [
      { type: 'string', name: 'market_id' },
      { type: 'string', name: 'user' }
    ], outputs: [{ type: 'tuple', components: [
      { type: 'uint256', name: 'yes' },
      { type: 'uint256', name: 'no' },
      { type: 'bool', name: 'claimed' }
    ]}] },
    { type: 'function', name: 'listMarkets', stateMutability: ['view'], inputs: [
      { type: 'uint256', name: 'offset' },
      { type: 'uint256', name: 'limit' }
    ], outputs: [{ type: 'tuple', components: [
      { type: 'string', name: 'market_id' },
      { type: 'string', name: 'agent' },
      { type: 'string', name: 'task' },
      { type: 'string', name: 'status' },
      { type: 'string', name: 'outcome' },
      { type: 'uint256', name: 'pool' }
    ]}] },
    { type: 'function', name: 'previewPayout', stateMutability: ['view'], inputs: [
      { type: 'string', name: 'market_id' },
      { type: 'string', name: 'user' }
    ], outputs: [{ type: 'uint256' }] },
    { type: 'function', name: 'isClaimed', stateMutability: ['view'], inputs: [
      { type: 'string', name: 'market_id' },
      { type: 'string', name: 'user' }
    ], outputs: [{ type: 'bool' }] },
    // Writes
    { type: 'function', name: 'createMarket', stateMutability: ['payable'], inputs: [
      { type: 'string', name: 'agent' },
      { type: 'string', name: 'task' },
      { type: 'string', name: 'deliverable_url' },
      { type: 'string', name: 'criteria' }
    ], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'stake', stateMutability: ['payable'], inputs: [
      { type: 'string', name: 'market_id' },
      { type: 'string', name: 'side' }
    ], outputs: [] },
    { type: 'function', name: 'resolve', stateMutability: ['nonpayable'], inputs: [
      { type: 'string', name: 'market_id' }
    ], outputs: [{ type: 'string' }] },
    { type: 'function', name: 'settle', stateMutability: ['nonpayable'], inputs: [
      { type: 'string', name: 'market_id' }
    ], outputs: [] },
    { type: 'function', name: 'claim', stateMutability: ['nonpayable'], inputs: [
      { type: 'string', name: 'market_id' }
    ], outputs: [{ type: 'uint256' }] },
  ];
}

function readContractSource() {
  return `import { gl, gl as gl$ } from 'genlayer';
import json from 'json'

// AgentPact contract
`
}

export function readContractSource() {
  return `import { gl } from 'genlayer'

@gl.evm.contract_interface
class _Payee:
    class View: pass
    class Write: pass

class AgentPact(gl.Contract):
    market_count: u256
    m_creator: TreeMap[str, str]
    m_agent: TreeMap[str, str]
    m_task: TreeMap[str, str]
    m_deliverable: TreeMap[str, str]
    m_criteria: TreeMap[str, str]
    m_status: TreeMap[str, str]
    m_outcome: TreeMap[str, str]
    m_pool: TreeMap[str, u256]
    m_members: TreeMap[str, str]
    m_positions: TreeMap[str, str]
    m_claimed: TreeMap[str, str]

    def __init__(self):
        self.market_count = u256(0)

    @gl.public.write
    def createMarket(self, agent: str, task: str, deliverable_url: str, criteria: str) -> str:
        agent = str(agent).strip()
        if not agent: raise gl.vm.UserError("Agent name required")
        if len(agent) > 100: raise gl.vm.UserError("Agent name too long")
        task = str(task).strip()
        if not task: raise gl.vm.UserError("Task required")
        if len(task) > 500: raise gl.vm.UserError("Task too long")
        deliverable_url = str(deliverable_url).strip()
        if not deliverable_url.startswith(("http://", "https://")): raise gl.vm.UserError("URL must be http(s)")
        if len(deliverable_url) > 2000: raise gl.vm.UserError("URL too long")
        criteria = str(criteria).strip()
        if not criteria: raise gl.vm.UserError("Criteria required")
        if len(criteria) > 1500: raise gl.vm.UserError("Criteria too long")
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
        side = str(side).strip().upper()[:4]
        if side not in ("YES", "NO"): raise gl.vm.UserError("Side must be YES or NO")
        if self.m_creator.get(market_id, None) is None: raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN": raise gl.vm.UserError("Market not open")
        amt = gl.message.value
        if amt <= u256(0): raise gl.vm.UserError("Must send GEN")
        sender = str(gl.message.sender_address)
        self.m_pool[market_id] = u256(int(self.m_pool.get(market_id, u256(0))) + int(amt))
        key = f"{market_id}:{sender}"
        pos = json.loads(self.m_positions.get(key, "{}"))
        pos[side] = int(pos.get(side, 0)) + int(amt)
        self.m_positions[key] = json.dumps(pos)
        members = self.m_members.get(market_id, "")
        if sender not in members.split(","): self.m_members[market_id] = (members + "," + sender) if members else sender

    @gl.public.write
    def resolve(self, market_id: str) -> str:
        if self.m_creator.get(market_id, None) is None: raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "OPEN": raise gl.vm.UserError("Already resolved")
        agent = self.m_agent.get(market_id, "")
        task = self.m_task.get(market_id, "")
        url = self.m_deliverable.get(market_id, "")
        criteria = self.m_criteria.get(market_id, "")
        def _judge() -> str:
            page = gl.nondet.web.request(str(url), method="GET")
            terms = [w.strip("?$.,.:;\\""'()").lower() for w in (task + " " + criteria).split() if len(w) > 3]
            hits = []
            for line in page.body.splitlines():
                ls = line.strip()
                if len(ls) < 20: continue
                if any(t in ls.lower() for t in terms): hits.append(ls)
                if len(hits) >= 60: break
            evidence = "\\n".join(hits) if hits else (page.body or b"")[:4000]
            if isinstance(evidence, bytes): evidence = evidence.decode("utf-8", errors="replace")
            verdict = gl.nondet.exec_prompt(
                "You are evaluating an AI agent's deliverable against explicit acceptance criteria.\\n"
                f"AGENT: {agent}\\n"
                f"TASK: {task}\\n"
                f"ACCEPTANCE CRITERIA:\\n{criteria}\\n\\n"
                f"DELIVERABLE:\\n{evidence[:4000]}\\n\\n"
                "Answer with exactly one word: YES if the deliverable meets the criteria, NO if it does not, or UNKNOWN if the evidence does not settle it. One word only."
            )
            v = str(verdict).strip().upper()
            if "UNKNOWN" in v: return "UNKNOWN"
            if "YES" in v: return "YES"
            if "NO" in v: return "NO"
            return "UNKNOWN"
        outcome = gl.eq_principle.prompt_comparative(_judge, f"Both must give the same one-word verdict (YES, NO, or UNKNOWN) for the deliverable of agent {agent} on task: {task}")
        decided = str(outcome).strip().upper()
        if decided not in ("YES", "NO"): raise gl.vm.UserError("Deliverable does not settle this market yet")
        self.m_status[market_id] = "RESOLVED"
        self.m_outcome[market_id] = decided
        return decided

    @gl.public.write
    def settle(self, market_id: str) -> None:
        if self.m_creator.get(market_id, None) is None: raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "RESOLVED": raise gl.vm.UserError("Not resolved")
        self.m_status[market_id] = "SETTLED"

    def _payout_for(self, market_id: str, who: str) -> int:
        outcome = self.m_outcome.get(market_id, "")
        if outcome not in ("YES", "NO"): return 0
        total_pool = int(self.m_pool.get(market_id, u256(0)))
        winning_pool = 0
        user_stake = 0
        members = self.m_members.get(market_id, "")
        for addr in members.split(","):
            if not addr: continue
            pos = json.loads(self.m_positions.get(f"{market_id}:{addr}", "{}"))
            stake = int(pos.get(outcome, 0))
            winning_pool += stake
            if addr == who: user_stake += stake
        if user_stake <= 0 or winning_pool <= 0: return 0
        return (user_stake * total_pool) // winning_pool

    @gl.public.write
    def claim(self, market_id: str) -> u256:
        if self.m_creator.get(market_id, None) is None: raise gl.vm.UserError("Market not found")
        if self.m_status.get(market_id, "") != "SETTLED": raise gl.vm.UserError("Not settled")
        sender = str(gl.message.sender_address)
        if self.m_claimed.get(f"{market_id}:{sender}", "") == "1": raise gl.vm.UserError("Already claimed")
        payout = self._payout_for(market_id, sender)
        if payout <= 0: raise gl.vm.UserError("No winning stake")
        self.m_claimed[f"{market_id}:{sender}"] = "1"
        _Payee(gl.message.sender_address).emit_transfer(value=u256(payout))
        return u256(payout)

    @gl.public.view
    def getMarket(self, market_id: str) -> dict:
        if self.m_creator.get(market_id, None) is None: return {"exists": False}
        members = [a for a in self.m_members.get(market_id, "").split(",") if a]
        return {"exists": True, "market_id": market_id, "agent": self.m_agent.get(market_id, ""), "task": self.m_task.get(market_id, ""), "deliverable_url": self.m_deliverable.get(market_id, ""), "criteria": self.m_criteria.get(market_id, ""), "status": self.m_status.get(market_id, ""), "outcome": self.m_outcome.get(market_id, ""), "pool": int(self.m_pool.get(market_id, u256(0))), "stakers": len(members)}

    @gl.public.view
    def getPosition(self, market_id: str, user: str) -> dict:
        key = f"{market_id}:{str(user)}"
        try: pos = json.loads(self.m_positions.get(key, "{}"))
        except Exception: pos = {}
        return {"yes": int(pos.get("YES", 0)), "no": int(pos.get("NO", 0)), "claimed": self.m_claimed.get(key, "") == "1"}

    @gl.public.view
    def listMarkets(self, offset: u256, limit: u256) -> dict:
        start = int(offset)
        total = int(self.market_count)
        count = min(int(limit), 20)
        out = []
        for i in range(start, min(start + count, total)):
            mid = f"market-{i + 1}"
            if self.m_creator.get(mid, None) is None: continue
            out.append({"market_id": mid, "agent": self.m_agent.get(mid, ""), "task": self.m_task.get(mid, ""), "status": self.m_status.get(mid, ""), "outcome": self.m_outcome.get(mid, ""), "pool": int(self.m_pool.get(mid, u256(0)))})
        return {"offset": start, "total": total, "markets": out}

    @gl.public.view
    def previewPayout(self, market_id: str, user: str) -> u256:
        if self.m_status.get(market_id, "") != "SETTLED": return u256(0)
        return u256(self._payout_for(market_id, str(user)))

    @gl.public.view
    def isClaimed(self, market_id: str, user: str) -> bool:
        return self.m_claimed.get(f"{market_id}:{str(user)}", "") == "1"

    @gl.public.view
    def getConfig(self) -> u256:
        return self.market_count
`
}
