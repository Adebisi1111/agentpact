import React, { useState, useCallback, useEffect, useRef } from 'react';

function App() {
  const [wallet, setWallet] = useState(null);
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState('idle');
  const [agent, setAgent] = useState('');
  const [task, setTask] = useState('');
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [criteria, setCriteria] = useState('');
  const [marketCount, setMarketCount] = useState(0);
  const [marketDetail, setMarketDetail] = useState(null);
  const isConnected = !!address;
  
  // Ref for toast timeout
  const toastTimeout = useRef(null);

  // Show toast
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) {
        showToast('No wallet found. Please install MetaMask or use WalletConnect.', 'error');
        return;
      }
      
      // Request account
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      setAddress(accounts[0]);
      setWallet('WalletConnected');
      showToast('Wallet connected!', 'success');
      
      // Load balance
      try {
        const bal = await ethereum.request({
          method: 'eth_getBalance',
          params: [accounts[0], 'latest'],
        });
        setBalance(bal);
      } catch (e) {
        setBalance(null);
      }
    } catch (error) {
      showToast('Failed to connect wallet: ' + error.message, 'error');
    }
  };

  // Load markets from API
  const loadMarkets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/markets');
      if (response.ok) {
        const data = await response.json();
        setMarketsData(data.markets || []);
        setMarketCount(data.marketCount || 0);
      }
    } catch (error) {
      console.error('Failed to load markets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  // Get contract ABI
  const getContractAbi = () => [
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

  // Create market contract call
  const createMarketContract = async (agent, task, deliverableUrl, criteria) => {
    // Read contract source
    const contractSource = readContractSource();
    
    // Deploy via genlayer-js
    const genlayer = await import('genlayer-js');
    const { testnetBradbury } = await import('genlayer-js/chains');
    
    const client = genlayer.createClient({
      chain: testnetBradbury,
      account: wallet.account,
    });
    
    const hash = await client.deployContract({
      code: contractSource,
      args: [],
      value: 0n,
      gasLimit: 5000000n,
    });
    
    const receipt = await client.waitForTransactionReceipt({ hash, retries: 120, interval: 5000 });
    return { txHash: hash, receipt };
  };

  // Read contract source
  const readContractSource = () => `
import { gl } from 'genlayer'

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
  `;

  // Create market via API
  const handleCreateMarket = async (e) => {
    e.preventDefault();
    if (!address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }
    if (!agent.trim() || !task.trim() || !deliverableUrl.trim() || !criteria.trim()) {
      showToast('All fields are required', 'error');
      return;
    }
    
    setCreateStep('loading');
    showToast('Creating market...', 'info');
    
    try {
      const response = await fetch('/api/create-market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: agent.trim(),
          task: task.trim(),
          deliverable_url: deliverableUrl.trim(),
          criteria: criteria.trim(),
        }),
      });
      
      const result = await response.json();
      if (result.success) {
        setCreateStep('done');
        setAgent('');
        setTask('');
        setDeliverableUrl('');
        setCriteria('');
        showToast('Market created!', 'success');
        setTimeout(() => {
          loadMarkets();
          setCreateStep('idle');
          setShowCreate(false);
        }, 10000);
      } else {
        showToast(result.error || 'Failed to create market', 'error');
      }
    } catch (error) {
      showToast('Failed to create market: ' + error.message, 'error');
    }
  };

  // Stake
  const handleStake = async (marketId, side) => {
    if (!address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }
    try {
      const response = await fetch('/api/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_id: marketId, side }),
      });
      const result = await response.json();
      if (result.success) {
        showToast(`Staked ${result.amount} GEN on ${side}`, 'success');
        loadMarkets();
      } else {
        showToast(result.error || 'Failed to stake', 'error');
      }
    } catch (error) {
      showToast('Failed to stake: ' + error.message, 'error');
    }
  };

  // Claim
  const handleClaim = async (marketId) => {
    if (!address) {
      showToast('Please connect your wallet first', 'error');
      return;
    }
    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market_id: marketId }),
      });
      const result = await response.json();
      if (result.success) {
        showToast(`Claimed ${result.payout} GEN!`, 'success');
        loadMarkets();
      } else {
        showToast(result.error || 'Failed to claim', 'error');
      }
    } catch (error) {
      showToast('Failed to claim: ' + error.message, 'error');
    }
  };

  // Check if user claimed
  const isClaimed = async (marketId) => {
    try {
      const response = await fetch(`/api/position?market_id=${marketId}&user=${address}`);
      if (response.ok) {
        const data = await response.json();
        return data.is_claimed || false;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  // Format GEN
  const formatGEN = (value) => {
    if (value === null || value === undefined) return '0 GEN';
    const num = typeof value === 'number' ? value : parseInt(value);
    return `${num.toLocaleString()} GEN`;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'RESOLVED': return <span className="badge badge-yes">Resolved (YES)</span>;
      case 'SETTLED': return <span className="badge badge-yes">Settled (YES)</span>;
      case 'OPEN': return <span className="badge badge-await">Pending</span>;
      default: return <span className="badge badge-unknown">{status}</span>;
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <a href="/" className="logo">
          <div className="logo-icon">
            <img src="/logo.svg" alt="AgentPact" />
          </div>
          AgentPact
        </a>
        <div className="topbar-right">
          {isConnected ? (
            <div className="wallet-btn connected">
              <span className="wallet-icon">👤</span>
              <span className="wallet-name">{address?.slice(0, 6) + '...' + address?.slice(-4)}</span>
              <button onClick={() => { setAddress(null); setWallet(null); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                ✕
              </button>
            </div>
          ) : (
            <button className="wallet-btn" onClick={connectWallet}>
              <span className="wallet-icon">🔗</span>
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>

      <div className="main">
        <div className="page-header">
          <h1>AI Agent Deliverable Prediction Market</h1>
          <p>Create a market on whether an AI agent's deliverable meets explicit criteria. Validators fetch the deliverable and judge it via GenLayer consensus. GEN stakes, parimutuel payout.</p>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-card">
            <span className="stat-label">Total Markets</span>
            <span className="stat-value accent">{marketCount}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Active Markets</span>
            <span className="stat-value">{markets.filter(m => m.status === 'OPEN').length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Pool</span>
            <span className="stat-value">{formatGEN(markets.reduce((sum, m) => sum + (m.pool || 0), 0))}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Settled</span>
            <span className="stat-value">{markets.filter(m => m.status === 'SETTLED').length}</span>
          </div>
        </div>

        {/* Create Market Modal */}
        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Create New Market</h3>
              <div className="form-card">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Agent Name (max 100 chars)</label>
                    <input type="text" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="e.g. DeepSeek-R1" maxLength={100} />
                  </div>
                  <div className="form-group">
                    <label>Task (max 500 chars)</label>
                    <input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Write a market analysis report" maxLength={500} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Deliverable URL (max 2000 chars)</label>
                  <input type="text" value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} placeholder="https://example.com/deliverable" maxLength={2000} />
                </div>
                <div className="form-group">
                  <label>Acceptance Criteria (max 1500 chars)</label>
                  <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="e.g. Report must be complete, accurate, cited, and within 2000 words" maxLength={1500} rows={4} />
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateMarket} disabled={createStep === 'loading'}>
                  {createStep === 'loading' ? <span className="spinner"></span> : 'Create Market'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Market list */}
        {marketCount > 0 && (
          <div className="markets-list">
            {markets.map((m) => (
              <div key={m.market_id} className="market-card">
                <div className="header">
                  <div className="title">{m.agent}</div>
                  <div className="meta">
                    <span>Pool: {formatGEN(m.pool)}</span>
                    <span>Stakers: {m.stakers}</span>
                    {getStatusBadge(m.status)}
                  </div>
                </div>
                <div className="sub">
                  <strong>Task:</strong> {m.task}
                </div>
                <div className="meta">
                  <span className="badge">Deliverable: {m.deliverable_url}</span>
                  <span className="badge">Criteria: {m.criteria}</span>
                </div>
                {(m.status === 'OPEN' || m.status === 'SETTLED') && (
                  <div className="actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => handleStake(m.market_id, 'YES')}
                      disabled={m.status !== 'OPEN' || !address}
                    >
                      Stake YES
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => handleStake(m.market_id, 'NO')}
                      disabled={m.status !== 'OPEN' || !address}
                    >
                      Stake NO
                    </button>
                    {m.status === 'SETTLED' && (
                      <button
                        className="btn btn-success"
                        onClick={() => handleClaim(m.market_id)}
                        disabled={!address || isClaimed(m.market_id)}
                      >
                        Claim Payout
                      </button>
                    )}
                  </div>
                )}
                {m.status === 'RESOLVED' && (
                  <div className="status info">
                    <span className="spinner" style={{ width: '16px', height: '16px' }}></span>
                    Resolved. Outcome: {m.outcome}. Market settled after delay.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {marketCount === 0 && (
          <div className="empty-state">
            <div className="icon">🔍</div>
            <h2>No Markets Yet</h2>
            <p>Create a market for an AI agent's deliverable to start a prediction market.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Create Market
            </button>
          </div>
        )}

        {/* Create button */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button className="btn btn-outline" onClick={() => setShowCreate(true)}>
            + Create New Market
          </button>
        </div>

        {/* Status messages */}
        {toast && (
          <div className={`toast ${toast.type === 'success' ? 'success' : toast.type === 'error' ? 'error' : 'info'}`}>
            {toast.message}
          </div>
        )}
      </div>

      <div className="mobile-nav" id="mobile-nav">
        <a onclick="closeMobileNav()">AgentPact</a>
        <a onclick="closeMobileNav()">Markets</a>
        <a href="#create" onclick="closeMobileNav()">Create Market</a>
      </div>
    </div>
  );
}

export default App;
