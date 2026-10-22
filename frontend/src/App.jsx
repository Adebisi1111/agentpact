import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

const CONTRACT_ADDRESS = '0x405CF4619e4692849b20273cd68657618fB01d99';

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
  const [client, setClient] = useState(null);
  const isConnected = !!address;

  const toastTimeout = useRef(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  };

  const connectWallet = async () => {
    try {
      const { ethereum } = window;
      if (!ethereum) { showToast('No wallet found. Please install MetaMask.', 'error'); return; }
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const addr = accounts[0];
      setAddress(addr);
      setWallet('connected');
      showToast('Wallet connected!', 'success');
      try {
        const bal = await ethereum.request({ method: 'eth_getBalance', params: [addr, 'latest'] });
        setBalance(bal);
      } catch (e) { setBalance(null); }
      const c = createClient({ chain: studionet, account: addr });
      setClient(c);
    } catch (error) {
      showToast('Failed to connect wallet: ' + error.message, 'error');
    }
  };

  const formatGEN = (value) => {
    if (value === null || value === undefined) return '0 GEN';
    const num = typeof value === 'number' ? value : Number(value);
    return `${num.toLocaleString()} GEN`;
  };

  const loadMarkets = useCallback(async () => {
    try {
      setLoading(true);
      const c = createClient({ chain: studionet });
      const config = await c.readContract({ address: CONTRACT_ADDRESS, functionName: 'getConfig', args: [] });
      const listResult = await c.readContract({ address: CONTRACT_ADDRESS, functionName: 'listMarkets', args: [0n, 20n] });
      const markets = (listResult.markets || []).map(m => ({
        market_id: m.market_id, agent: m.agent, task: m.task, status: m.status,
        outcome: m.outcome, pool: Number(m.pool),
      }));
      setMarkets(markets);
      setMarketCount(Number(config));
    } catch (error) {
      console.error('Failed to load markets:', error);
      showToast('Failed to load markets', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  const handleCreateMarket = async (e) => {
    e.preventDefault();
    if (!address) { showToast('Please connect your wallet first', 'error'); return; }
    if (!agent.trim() || !task.trim() || !deliverableUrl.trim() || !criteria.trim()) { showToast('All fields are required', 'error'); return; }
    if (!client) { showToast('Wallet not connected', 'error'); return; }
    setCreateStep('loading');
    showToast('Creating market...', 'info');
    try {
      const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'createMarket', args: [agent.trim(), task.trim(), deliverableUrl.trim(), criteria.trim()], value: 0n, gasLimit: 5000000n });
      await client.waitForTransactionReceipt({ hash, retries: 60, interval: 3000 });
      setCreateStep('done');
      setAgent(''); setTask(''); setDeliverableUrl(''); setCriteria('');
      showToast('Market created!', 'success');
      setTimeout(() => { loadMarkets(); setCreateStep('idle'); setShowCreate(false); }, 3000);
    } catch (error) {
      showToast('Failed to create market: ' + error.message, 'error');
      setCreateStep('idle');
    }
  };

  const handleStake = async (marketId, side) => {
    if (!address || !client) { showToast('Please connect your wallet first', 'error'); return; }
    try {
      showToast(`Staking on ${side}...`, 'info');
      const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'stake', args: [marketId, side], value: 1000000000000000000n, gasLimit: 5000000n });
      await client.waitForTransactionReceipt({ hash, retries: 60, interval: 3000 });
      showToast(`Staked 1 GEN on ${side}`, 'success');
      loadMarkets();
    } catch (error) { showToast('Failed to stake: ' + error.message, 'error'); }
  };

  const handleResolve = async (marketId) => {
    if (!address || !client) { showToast('Please connect your wallet first', 'error'); return; }
    try {
      showToast('Resolving market...', 'info');
      const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'resolve', args: [marketId], gasLimit: 5000000n });
      await client.waitForTransactionReceipt({ hash, retries: 60, interval: 3000 });
      showToast('Market resolved!', 'success');
      loadMarkets();
    } catch (error) { showToast('Failed to resolve: ' + error.message, 'error'); }
  };

  const handleSettle = async (marketId) => {
    if (!address || !client) { showToast('Please connect your wallet first', 'error'); return; }
    try {
      showToast('Settling market...', 'info');
      const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'settle', args: [marketId], gasLimit: 5000000n });
      await client.waitForTransactionReceipt({ hash, retries: 60, interval: 3000 });
      showToast('Market settled!', 'success');
      loadMarkets();
    } catch (error) { showToast('Failed to settle: ' + error.message, 'error'); }
  };

  const handleClaim = async (marketId) => {
    if (!address || !client) { showToast('Please connect your wallet first', 'error'); return; }
    try {
      showToast('Claiming payout...', 'info');
      const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName: 'claim', args: [marketId], gasLimit: 5000000n });
      await client.waitForTransactionReceipt({ hash, retries: 60, interval: 3000 });
      showToast('Payout claimed!', 'success');
      loadMarkets();
    } catch (error) { showToast('Failed to claim: ' + error.message, 'error'); }
  };

  const getStatusBadge = (status, outcome) => {
    switch (status) {
      case 'RESOLVED': return <span className="badge badge-await">Resolved ({outcome})</span>;
      case 'SETTLED': return <span className="badge badge-yes">Settled ({outcome})</span>;
      case 'OPEN': return <span className="badge badge-await">Open</span>;
      default: return <span className="badge badge-unknown">{status}</span>;
    }
  };

  return (
    <div className="app">
      <div className="topbar">
        <a href="/" className="logo">
          <div className="logo-icon"><img src="/logo.svg" alt="AgentPact" /></div>
          AgentPact
        </a>
        <div className="topbar-right">
          {isConnected ? (
            <div className="wallet-btn connected">
              <span className="wallet-icon">👤</span>
              <span className="wallet-name">{address?.slice(0, 6) + '...' + address?.slice(-4)}</span>
              <button onClick={() => { setAddress(null); setWallet(null); setClient(null); }} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: '4px' }}>✕</button>
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

        <div className="stats-bar">
          <div className="stat-card"><span className="stat-label">Total Markets</span><span className="stat-value accent">{marketCount}</span></div>
          <div className="stat-card"><span className="stat-label">Active Markets</span><span className="stat-value">{markets.filter(m => m.status === 'OPEN').length}</span></div>
          <div className="stat-card"><span className="stat-label">Total Pool</span><span className="stat-value">{formatGEN(markets.reduce((sum, m) => sum + (m.pool || 0), 0))}</span></div>
          <div className="stat-card"><span className="stat-label">Settled</span><span className="stat-value">{markets.filter(m => m.status === 'SETTLED').length}</span></div>
        </div>

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Create New Market</h3>
              <p>Define an AI agent, task, deliverable URL, and acceptance criteria.</p>
              <div className="form-card" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                <div className="form-grid">
                  <div className="form-group"><label>Agent Name</label><input type="text" value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="e.g. DeepSeek-R1" maxLength={100} /></div>
                  <div className="form-group"><label>Task</label><input type="text" value={task} onChange={(e) => setTask(e.target.value)} placeholder="e.g. Write a market analysis report" maxLength={500} /></div>
                </div>
                <div className="form-group"><label>Deliverable URL</label><input type="text" value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} placeholder="https://example.com/deliverable" maxLength={2000} /></div>
                <div className="form-group"><label>Acceptance Criteria</label><textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="e.g. Report must be complete, accurate, cited, and within 2000 words" maxLength={1500} rows={4} /></div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateMarket} disabled={createStep === 'loading'}>{createStep === 'loading' ? <span className="spinner"></span> : 'Create Market'}</button>
              </div>
            </div>
          </div>
        )}

        {loading && markets.length === 0 && (
          <div className="markets-list">
            {[1,2,3].map(i => (<div key={i} className="market-card" style={{ opacity: 0.5 }}><div className="header"><div className="title">Loading...</div></div><div className="sub">Fetching markets from chain...</div></div>))}
          </div>
        )}

        {!loading && marketCount > 0 && (
          <div className="markets-list">
            {markets.map((m) => (
              <div key={m.market_id} className="market-card">
                <div className="header">
                  <div className="title">{m.agent}</div>
                  <div className="meta"><span>Pool: {formatGEN(m.pool)}</span>{getStatusBadge(m.status, m.outcome)}</div>
                </div>
                <div className="sub"><strong>Task:</strong> {m.task}</div>
                <div className="meta"><span>Market: {m.market_id}</span></div>
                {(m.status === 'OPEN' || m.status === 'SETTLED' || m.status === 'RESOLVED') && (
                  <div className="actions">
                    <button className="btn btn-primary" onClick={() => handleStake(m.market_id, 'YES')} disabled={m.status !== 'OPEN' || !address}>Stake YES (1 GEN)</button>
                    <button className="btn btn-outline" onClick={() => handleStake(m.market_id, 'NO')} disabled={m.status !== 'OPEN' || !address}>Stake NO (1 GEN)</button>
                    {m.status === 'OPEN' && (<button className="btn btn-outline" onClick={() => handleResolve(m.market_id)} disabled={!address}>Resolve</button>)}
                    {m.status === 'RESOLVED' && (<button className="btn btn-outline" onClick={() => handleSettle(m.market_id)} disabled={!address}>Settle</button>)}
                    {m.status === 'SETTLED' && (<button className="btn btn-success" onClick={() => handleClaim(m.market_id)} disabled={!address}>Claim Payout</button>)}
                  </div>
                )}
                {m.status === 'RESOLVED' && (<div className="status info"><span className="spinner" style={{ width: '14px', height: '14px' }}></span>Resolved: {m.outcome}. Click Settle to finalize.</div>)}
              </div>
            ))}
          </div>
        )}

        {!loading && marketCount === 0 && (
          <div className="empty-state">
            <div className="icon">📊</div>
            <h3>No Markets Yet</h3>
            <p>Create a market for an AI agent's deliverable to start a prediction market.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: '16px' }}>Create Market</button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button className="btn btn-outline" onClick={() => setShowCreate(true)}>+ Create New Market</button>
        </div>

        {toast && (<div className={`toast ${toast.type === 'success' ? 'success' : toast.type === 'error' ? 'error' : 'info'}`}>{toast.message}</div>)}
      </div>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>
        AgentPact — Prediction market on AI agent deliverable quality. Powered by GenLayer consensus.
        <br />
        <a href="https://github.com/Adebisi1111/agentpact" target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'none' }}>GitHub</a>
        {' · '}
        <a href={`https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Contract Explorer</a>
      </footer>
    </div>
  );
}

export default App;
