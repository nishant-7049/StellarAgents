"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { ChevronDown, Copy, Zap, LogOut } from "lucide-react";

export function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function copyAddress() {
    if (address) navigator.clipboard.writeText(address);
    setOpen(false);
  }

  if (isConnected && address) {
    const short = `${address.slice(0, 4)}…${address.slice(-4)}`;
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[10px]
            bg-[var(--surface1)] border border-[var(--border)] text-[13px] font-mono
            text-[var(--text-secondary)] hover:border-[var(--accent)]/30
            hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] flex-shrink-0" />
          {short}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-[14px]
            bg-[var(--bg1)] border border-[var(--border)]
            shadow-[0_8px_24px_rgba(15,23,42,0.12)] z-50 overflow-hidden py-1">
            <button
              onClick={copyAddress}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px]
                text-[var(--text-secondary)] hover:bg-[var(--surface1)] hover:text-[var(--text-primary)]
                transition-colors text-left"
            >
              <Copy className="w-3.5 h-3.5 flex-shrink-0" />
              Copy address
            </button>
            <Link
              href="/credits"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]
                text-[var(--text-secondary)] hover:bg-[var(--surface1)] hover:text-[var(--text-primary)]
                transition-colors"
            >
              <Zap className="w-3.5 h-3.5 flex-shrink-0 text-[var(--accent)]" />
              Credits &amp; plan
            </Link>
            <div className="border-t border-[var(--border)] mx-3 my-1" />
            <button
              onClick={() => { disconnect(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px]
                text-[var(--danger)] hover:bg-red-50 transition-colors text-left"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="px-3.5 py-1.5 rounded-[10px] text-[13px] font-medium
        border border-[var(--accent)]/40 text-[var(--accent)]
        hover:bg-[var(--accent)]/8 hover:border-[var(--accent)]/60
        disabled:opacity-50 transition-colors"
    >
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
