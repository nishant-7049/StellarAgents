"use client";
import { WalletButton } from "./WalletButton";
import { Badge } from "@/components/ui/Badge";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur px-6">
      <div className="flex items-center gap-3">
        <Badge variant="info">Testnet</Badge>
      </div>
      <WalletButton />
    </header>
  );
}
