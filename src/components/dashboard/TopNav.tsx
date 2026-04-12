"use client";
import { WalletButton } from "./WalletButton";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-end
      border-b border-[var(--border)] bg-[var(--bg1)]/95 backdrop-blur px-6">
      <WalletButton />
    </header>
  );
}
