// Vercel serverless function: create a new market
const BRADBURY_RPC = process.env.BRADBURY_RPC || 'https://rpc-bradbury.genlayer.com';
const AGENTPACT_CONTRACT = process.env.AGENTPACT_CONTRACT || '0x1e3BB7F5B6489bC2071D77Edf38C6469EE9B4B04';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { agent, task, deliverable_url, criteria } = body;
    
    if (!agent || !task || !deliverable_url || !criteria) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(BRADBURY_RPC);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '0x', provider);
    const contract = new ethers.Contract(AGENTPACT_CONTRACT, ABIs, wallet);
    
    const calldata = contract.interface.encodeFunctionData('createMarket', [
      agent,
      task,
      deliverable_url,
      criteria
    ]);
    
    const tx = await contract.createMarket(agent, task, deliverable_url, criteria, {
      value: 0n,
      gasLimit: 5000000n,
    });
    
    const receipt = await tx.wait();
    
    res.status(200).json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: error.message });
  }
}

const ABIs = [
  { type: 'function', name: 'createMarket', stateMutability: 'payable', inputs: [
    { type: 'string', name: 'agent' },
    { type: 'string', name: 'task' },
    { type: 'string', name: 'deliverable_url' },
    { type: 'string', name: 'criteria' }
  ], outputs: [{ type: 'string' }] },
];
