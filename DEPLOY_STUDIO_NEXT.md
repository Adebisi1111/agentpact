# Deploy to Studio Next using genlayer-js 2.0.0-rc.1

## Setup
```bash
npm install genlayer-js@2.0.0-rc.1
```

## Create deploy.js
```javascript
import { createClient, http } from 'genlayer-js';
import fs from 'fs';

// Studio Next chain config
const studioNext = {
  id: 61997,
  name: 'Studio Next',
  rpcUrl: 'https://studio-next.genlayer.com/api',
  nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 }
};

const client = createClient({
  chain: studioNext,
  transport: http('https://studio-next.genlayer.com/api')
});

async function deploy() {
  const code = fs.readFileSync('contracts/agentpact_v5.py', 'utf8');
  
  try {
    const result = await client.deployContract({ code });
    console.log('Deployed:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

deploy();
```

## Run
```bash
node deploy.js
```

**Problem**: `client.deployContract` requires an account. The account must be set in the client config or passed to the function.

**Solution**: Export your private key from MetaMask and use it:
```javascript
const account = privateKeyToAccount('0x...your_private_key...');
const client = createClient({ chain: studioNext, account, transport: ... });
```

**OR** use the GenLayer Studio UI — the only reliable path right now.
