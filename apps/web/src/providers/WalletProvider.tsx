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

const STORAGE_KEY = "agentnet_wallet";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [isConnecting, setIsConnecting] = useState(false);

  // On mount: verify the persisted address is still authorized in Freighter
  useEffect(() => {
    const persisted = localStorage.getItem(STORAGE_KEY);
    if (persisted) {
      // Confirm Freighter still has the same key (handles account switch)
      getPublicKey().then(addr => {
        if (addr && addr === persisted) {
          setAddress(addr);
        } else if (addr && addr !== persisted) {
          // Account switched in Freighter — update to new address
          localStorage.setItem(STORAGE_KEY, addr);
          setAddress(addr);
        }
        // If addr is null, Freighter isn't ready yet — keep persisted address
        // so UI doesn't flicker; next explicit connect will re-auth
      });
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const installed = await isFreighterInstalled();
      if (!installed) { alert("Please install Freighter wallet extension"); return; }
      const addr = await connectWallet();
      localStorage.setItem(STORAGE_KEY, addr);
      setAddress(addr);
    } catch (err) {
      console.error("Wallet connect failed:", err);
    } finally { setIsConnecting(false); }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAddress(null);
  }, []);

  return (
    <WalletContext.Provider value={{ address, isConnected: !!address, isConnecting, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWalletContext = () => useContext(WalletContext);
