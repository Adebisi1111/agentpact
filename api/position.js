// Vercel serverless function: get position
const BRADBURY_RPC = process.env.BRADBURY_RPC || 'https://rpc-bradbury.genlayer.com';
const AGENTPACT_CONTRACT = process.env.AGENTPACT_CONTRACT || '0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { market_id, user } = req.query;
    
    if (!market_id || !user) {
      return res.status(400).json({ error: 'market_id and user required' });
    }
    
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(BRADBURY_RPC);
    const contract = new ethers.Contract(AGENTPACT_CONTRACT, ABIs, provider);
    
    const position = await contract.getPosition(market_id, user);
    
    res.status(200).json({
      yes: position.yes,
      no: position.no,
      claimed: position.claimed,
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
}

const ABIs = [
  { type: 'function', name: 'getPosition', stateMutability: 'view', inputs: [
    { type: 'string', name: 'market_id' },
    { type: 'string', name: 'user' }
  ], outputs: [{ type: 'tuple', components: [
    { type: 'uint256', name: 'yes' },
    { type: 'uint256', name: 'no' },
    { type: 'bool', name: 'claimed' }
  ]}] },
];
