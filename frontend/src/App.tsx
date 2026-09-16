import { useState, useCallback, useEffect } from 'react';
import { createGenlayerClient, CONTRACT_ADDRESS } from './client';
import { useWallet } from './WalletProvider';

interface Agreement {
  id: string;
  hiree: string;
  worker: string;
  terms: string;
  payment_per_tick: number;
  interval_seconds: number;
  next_deadline: number;
  total_ticks: number;
  paid_ticks: number;
  status: string;
  violations: number;
  last_proof_hash: string;
  last_check_status: string;
  last_response_time: number;
  consecutive_failures: number;
  uptime_required: number;
  response_time_required: number;
  penalty_rate: number;
  total_deposited: number;
  total_paid_out: number;
  total_refunded: number;
  total_penalties: number;
}

function App() {
  const { address, isConnected, isOnCorrectNetwork, isLoading, connectWallet, disconnectWallet } = useWallet();
  const [client, setClient] = useState<ReturnType<typeof createGenlayerClient> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [agreementId, setAgreementId] = useState('SA-001');
  const [workerAddress, setWorkerAddress] = useState('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const [termsUrl, setTermsUrl] = useState('https://api.example.com/terms');
  const [paymentPerTick, setPaymentPerTick] = useState(1000);
  const [intervalSeconds, setIntervalSeconds] = useState(3600);
  const [totalTicks, setTotalTicks] = useState(10);
  const [uptimeRequired, setUptimeRequired] = useState(95);
  const [responseTimeRequired, setResponseTimeRequired] = useState(2000);
  const [penaltyRate, _setPenaltyRate] = useState(10);

  // View state
  const [viewId, setViewId] = useState('');
  const [agreement, setAgreement] = useState<Agreement | null>(null);

  // Initialize client when wallet connects
  useEffect(() => {
    if (address && !client) {
      const c = createGenlayerClient(address);
      setClient(c);
    } else if (!address && client) {
      setClient(null);
    }
  }, [address, client]);

  const handleConnect = async () => {
    try {
      setError(null);
      setLoading(true);
      await connectWallet();
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setClient(null);
    setError(null);
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const createAgreement = useCallback(async () => {
    if (!client || !address) {
      setError('Please connect wallet first');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const totalEscrow = BigInt(paymentPerTick) * BigInt(totalTicks);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'create_agreement',
        args: [agreementId, workerAddress, termsUrl, BigInt(paymentPerTick), BigInt(intervalSeconds), BigInt(totalTicks), BigInt(uptimeRequired), BigInt(responseTimeRequired), BigInt(penaltyRate)],
        value: totalEscrow,
      });
      setSuccess('✅ Created! Tx: ' + hash.slice(0, 20) + '...');
      setTimeout(() => viewAgreementById(agreementId), 3000);
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [client, address, agreementId, workerAddress, termsUrl, paymentPerTick, intervalSeconds, totalTicks, uptimeRequired, responseTimeRequired, penaltyRate]);

  const fundAgreement = useCallback(async () => {
    if (!client || !address) {
      setError('Please connect wallet first');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'fund_agreement',
        args: [agreementId],
        value: BigInt(paymentPerTick) * BigInt(totalTicks),
      });
      setSuccess('✅ Funded! Tx: ' + hash.slice(0, 20) + '...');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [client, address, agreementId, paymentPerTick, totalTicks]);

  const submitProof = useCallback(async () => {
    if (!client || !address) {
      setError('Please connect wallet first');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const proofHash = '0x' + Math.random().toString(16).slice(2, 14);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'submit_proof',
        args: [agreementId, proofHash, BigInt(responseTimeRequired)],
        value: 0n,
      });
      setSuccess('✅ Proof submitted! Tx: ' + hash.slice(0, 20) + '...');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [client, address, agreementId, responseTimeRequired]);

  const reportViolation = useCallback(async () => {
    if (!client || !address) {
      setError('Please connect wallet first');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'report_violation',
        args: [agreementId],
        value: 0n,
      });
      setSuccess('✅ Violation reported! Tx: ' + hash.slice(0, 20) + '...');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [client, address, agreementId]);

  const cancelAgreement = useCallback(async () => {
    if (!client || !address) {
      setError('Please connect wallet first');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'cancel_agreement',
        args: [agreementId],
        value: 0n,
      });
      setSuccess('✅ Cancelled! Tx: ' + hash.slice(0, 20) + '...');
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setLoading(false);
    }
  }, [client, address, agreementId]);

  const viewAgreement = useCallback(async () => {
    if (!client) {
      setError('Please connect wallet first');
      return;
    }
    clearMessages();
    setLoading(true);
    try {
      const result = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_agreement',
        args: [viewId],
      });
      if (result) {
        setAgreement(result as unknown as Agreement);
        setSuccess('Agreement loaded');
      } else {
        setError('Agreement not found: ' + viewId);
        setAgreement(null);
      }
    } catch (err: any) {
      setError(err.message || 'Read failed');
      setAgreement(null);
    } finally {
      setLoading(false);
    }
  }, [client, viewId]);

  const viewAgreementById = async (id: string) => {
    setViewId(id);
    if (client) {
      try {
        const result = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_agreement',
          args: [id],
        });
        if (result) {
          setAgreement(result as unknown as Agreement);
        }
      } catch (err) {
        // Ignore
      }
    }
  };

  const isReady = isConnected && isOnCorrectNetwork && client;

  return (
    <div className="min-h-screen bg-[#06080f] text-[#d6e4f0] font-['Quantico',system-ui,sans-serif]">
      {/* Nav */}
      <nav className="flex items-center gap-8 px-8 py-6 max-w-[1200px] mx-auto">
        <a href="index.html" className="text-[#15BCDF] text-xl font-bold mr-auto no-underline">⚡ AgentPact</a>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isConnected ? (isOnCorrectNetwork ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400') : 'bg-red-500/15 text-red-400'}`}>
          {isConnected ? (isOnCorrectNetwork ? `✓ ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Wrong Network') : 'Disconnected'}
        </span>
        {isConnected ? (
          <button onClick={handleDisconnect} className="px-5 py-2 rounded-lg border border-red-500 text-red-500 font-bold text-sm hover:bg-red-500/10 transition-colors">
            Disconnect
          </button>
        ) : (
          <button onClick={handleConnect} disabled={isLoading} className="px-5 py-2 rounded-lg border border-[#15BCDF] text-[#15BCDF] font-bold text-sm hover:bg-[#15BCDF] hover:text-[#06080f] transition-colors disabled:opacity-50">
            {isLoading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </nav>

      <main className="max-w-[900px] mx-auto px-8">
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-[#d6e4f0] to-[#15BCDF] bg-clip-text text-transparent">AGENTPACT APP</h1>
        <p className="text-[#7d8ba6] mb-8 text-lg">Trustless service agreements on GenLayer Studio Next</p>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-6 text-red-400">{error}</div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500 rounded-lg p-4 mb-6 text-green-400">{success}</div>
        )}

        {!isOnCorrectNetwork && isConnected && (
          <div className="bg-yellow-500/10 border border-yellow-500 rounded-lg p-4 mb-6 text-yellow-400">
            ⚠️ Please switch to GenLayer Studio Next (chain 61997) in your wallet
          </div>
        )}

        {/* Create */}
        <div className="bg-[#0c1220] border border-[#15Bcdf]/15 rounded-lg p-6 mb-6">
          <h3 className="text-[#15BCDF] mb-4 text-lg">📝 Create Agreement</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Agreement ID</label>
              <input value={agreementId} onChange={e => setAgreementId(e.target.value)} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Worker Address</label>
              <input value={workerAddress} onChange={e => setWorkerAddress(e.target.value)} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Terms URL</label>
              <input value={termsUrl} onChange={e => setTermsUrl(e.target.value)} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Payment per tick (wei)</label>
              <input type="number" value={paymentPerTick} onChange={e => setPaymentPerTick(Number(e.target.value))} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Interval (seconds)</label>
              <input type="number" value={intervalSeconds} onChange={e => setIntervalSeconds(Number(e.target.value))} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Total ticks</label>
              <input type="number" value={totalTicks} onChange={e => setTotalTicks(Number(e.target.value))} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Uptime required (%)</label>
              <input type="number" value={uptimeRequired} onChange={e => setUptimeRequired(Number(e.target.value))} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
            <div>
              <label className="text-xs text-[#7d8ba6] block mb-1">Max response time (ms)</label>
              <input type="number" value={responseTimeRequired} onChange={e => setResponseTimeRequired(Number(e.target.value))} className="w-full px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={createAgreement} disabled={!isReady || loading} className="px-6 py-3 bg-[#15BCDF] text-[#06080f] font-bold rounded-lg hover:shadow-lg hover:shadow-[#15BCDF]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Processing...' : 'Create Agreement'}
            </button>
            <button onClick={fundAgreement} disabled={!isReady || loading} className="px-6 py-3 border border-[#15BCDF] text-[#15BCDF] font-bold rounded-lg hover:bg-[#15BCDF]/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Fund Agreement
            </button>
          </div>
        </div>

        {/* Submit Proof / Violations */}
        <div className="bg-[#0c1220] border border-[#15Bcdf]/15 rounded-lg p-6 mb-6">
          <h3 className="text-[#15BCDF] mb-4 text-lg">✅ Submit Proof / Report</h3>
          <div className="flex gap-4 mb-4">
            <input value={agreementId} onChange={e => setAgreementId(e.target.value)} placeholder="Agreement ID" className="flex-1 px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            <button onClick={submitProof} disabled={!isReady || loading} className="px-6 py-3 bg-[#15BCDF] text-[#06080f] font-bold rounded-lg hover:shadow-lg hover:shadow-[#15BCDF]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Submit Proof
            </button>
          </div>
          <div className="flex gap-4">
            <button onClick={reportViolation} disabled={!isReady || loading} className="px-6 py-3 border border-red-500 text-red-500 font-bold rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Report Violation
            </button>
            <button onClick={cancelAgreement} disabled={!isReady || loading} className="px-6 py-3 border border-red-500 text-red-500 font-bold rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              Cancel Agreement
            </button>
          </div>
        </div>

        {/* View Agreement */}
        <div className="bg-[#0c1220] border border-[#15Bcdf]/15 rounded-lg p-6 mb-6">
          <h3 className="text-[#15BCDF] mb-4 text-lg">🔍 View Agreement</h3>
          <div className="flex gap-4 mb-4">
            <input value={viewId} onChange={e => setViewId(e.target.value)} placeholder="Enter agreement ID" className="flex-1 px-4 py-3 bg-[#131b2e] border border-[#15Bcdf]/20 rounded-lg text-sm focus:outline-none focus:border-[#15BCDF] focus:ring-2 focus:ring-[#15BCDF]/30" />
            <button onClick={viewAgreement} disabled={!isReady || loading} className="px-6 py-3 bg-[#15BCDF] text-[#06080f] font-bold rounded-lg hover:shadow-lg hover:shadow-[#15BCDF]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              View
            </button>
          </div>
          {agreement && (
            <pre className="bg-[#131b2e] rounded-lg p-4 text-xs font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
              {JSON.stringify(agreement, null, 2)}
            </pre>
          )}
        </div>
      </main>

      <footer className="text-center py-8 text-[#7d8ba6] text-sm border-t border-[#15Bcdf]/10 mt-12">
        <div className="mb-2">© 2026 AgentPact — Built on GenLayer</div>
        <div className="opacity-70">Contract: 0x9bC45B33FCaa6CEdFE4edA477EB10A4F31Ddee9E</div>
      </footer>
    </div>
  );
}

export default App;
