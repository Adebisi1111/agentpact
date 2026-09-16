import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const DISCONNECT_FLAG = 'wallet_disconnected';

export interface WalletState {
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  isMetaMaskInstalled: boolean;
  isOnCorrectNetwork: boolean;
}

interface WalletContextValue extends WalletState {
  connectWallet: () => Promise<string>;
  disconnectWallet: () => void;
  switchWalletAccount: () => Promise<string>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

function getEthereum() {
  return (window as any).ethereum as any;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    isConnected: false,
    isLoading: true,
    isMetaMaskInstalled: false,
    isOnCorrectNetwork: false,
  });

  useEffect(() => {
    const initWallet = async () => {
      const ethereum = getEthereum();
      if (!ethereum?.isMetaMask) {
        setState({ address: null, chainId: null, isConnected: false, isLoading: false, isMetaMaskInstalled: false, isOnCorrectNetwork: false });
        return;
      }

      const wasDisconnected = localStorage.getItem(DISCONNECT_FLAG) === 'true';
      if (wasDisconnected) {
        setState({ address: null, chainId: null, isConnected: false, isLoading: false, isMetaMaskInstalled: true, isOnCorrectNetwork: false });
        return;
      }

      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' }) as string[];
        const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
        if (accounts && accounts.length > 0) {
          setState({ address: accounts[0], chainId, isConnected: true, isLoading: false, isMetaMaskInstalled: true, isOnCorrectNetwork: chainId === '0x1194D' });
        } else {
          setState({ address: null, chainId, isConnected: false, isLoading: false, isMetaMaskInstalled: true, isOnCorrectNetwork: chainId === '0x1194D' });
        }
      } catch (err) {
        setState({ address: null, chainId: null, isConnected: false, isLoading: false, isMetaMaskInstalled: true, isOnCorrectNetwork: false });
      }
    };

    initWallet();

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(prev => ({ ...prev, address: null, isConnected: false }));
      } else {
        const chainId = await getEthereum().request({ method: 'eth_chainId' }) as string;
        setState(prev => ({ ...prev, address: accounts[0], chainId, isConnected: true, isOnCorrectNetwork: chainId === '0x1194D' }));
      }
    };

    const handleChainChanged = async (chainId: string) => {
      const accounts = await getEthereum().request({ method: 'eth_accounts' }) as string[];
      setState(prev => ({ ...prev, chainId, isConnected: accounts.length > 0, isOnCorrectNetwork: chainId === '0x1194D' }));
    };

    const ethereum = getEthereum();
    if (ethereum) {
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      const eth = getEthereum();
      if (eth) {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const connectWallet = useCallback(async (): Promise<string> => {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const addr = accounts[0];
      const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
      
      if (chainId !== '0x1194D') {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x1194D',
              chainName: 'GenLayer Studio Next',
              rpcUrls: ['https://studio-next.genlayer.com/api'],
              nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
              blockExplorerUrls: ['https://explorer-studio-dev.genlayer.com/'],
            }],
          });
        } catch (addError: any) {
          if (addError.code !== 4001) throw addError;
        }
        await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1194D' }] });
      }

      localStorage.removeItem(DISCONNECT_FLAG);
      setState({ address: addr, chainId: '0x1194D', isConnected: true, isLoading: false, isMetaMaskInstalled: true, isOnCorrectNetwork: true });
      return addr;
    } catch (err: any) {
      if (err.code === 4001) {
        throw new Error('User rejected the connection request');
      }
      throw err;
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    localStorage.setItem(DISCONNECT_FLAG, 'true');
    setState({ address: null, chainId: null, isConnected: false, isLoading: false, isMetaMaskInstalled: true, isOnCorrectNetwork: false });
  }, []);

  const switchWalletAccount = useCallback(async (): Promise<string> => {
    const ethereum = getEthereum();
    if (!ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const addr = accounts[0];
      const chainId = await ethereum.request({ method: 'eth_chainId' }) as string;
      setState({ address: addr, chainId, isConnected: true, isLoading: false, isMetaMaskInstalled: true, isOnCorrectNetwork: chainId === '0x1194D' });
      return addr;
    } catch (err: any) {
      if (err.code === 4001) {
        throw new Error('User rejected the request');
      }
      throw err;
    }
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connectWallet, disconnectWallet, switchWalletAccount }}>
      {children}
    </WalletContext.Provider>
  );
}
