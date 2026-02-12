"use client";
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { isFreighterInstalled, connectWallet, getPublicKey } from "@/lib/freighter";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null, isConnected: false, isConnecting: false,
  connect: async () => {}, disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    getPublicKey().then(addr => { if (addr) setAddress(addr); });
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const installed = await isFreighterInstalled();
      if (!installed) { alert("Please install Freighter wallet extension"); return; }
      const addr = await connectWallet();
      setAddress(addr);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally { setIsConnecting(false); }
  }, []);

  const disconnect = useCallback(() => { setAddress(null); }, []);

  return (
    <WalletContext.Provider value={{ address, isConnected: !!address, isConnecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWalletContext = () => useContext(WalletContext);
