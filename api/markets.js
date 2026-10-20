// Vercel serverless function: list markets from AgentPact contract
const BRADBURY_RPC = process.env.BRADBURY_RPC || 'https://rpc-bradbury.genlayer.com';
const AGENTPACT_CONTRACT = process.env.AGENTPACT_CONTRACT || '0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(BRADBURY_RPC);
    const contract = new ethers.Contract(AGENTPACT_CONTRACT, ABIs, provider);
    
    const config = await contract.getConfig();
    const offset = 0;
    const limit = 20;
    const listResult = await contract.listMarkets(offset, limit);
    
    const markets = listResult.map(m => ({
      market_id: m.market_id,
      agent: m.agent,
      task: m.task,
      status: m.status,
      outcome: m.outcome,
      pool: formatGEN(m.pool),
      stakers: m.stakers,
    }));
    
    res.status(200).json({
      marketCount: config,
      total: markets.length,
      markets: markets,
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
}

function formatGEN(value) {
  const num = typeof value === 'number' ? value : BigInt(value);
  return `${Number(num).toLocaleString()} GEN`;
}

const ABIs = [
  { type: 'function', name: 'getConfig', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'listMarkets', stateMutability: 'view', inputs: [
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
];
