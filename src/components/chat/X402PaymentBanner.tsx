"use client";
import { Badge } from "@/components/ui/Badge";

interface X402PaymentBannerProps {
  txHash: string;
  amount: string;
}

export function X402PaymentBanner({ txHash, amount }: X402PaymentBannerProps) {
  const usdc = (parseInt(amount) / 10_000_000).toFixed(4);
  return (
    <div className="flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/30 p-3">
      <Badge variant="success">Paid</Badge>
      <div className="text-sm">
        <span className="text-green-300 font-semibold">{usdc} USDC</span>
        <span className="text-[var(--text-secondary)]"> via x402</span>
      </div>
      <span className="ml-auto text-xs font-mono text-[var(--text-secondary)]">
        {txHash.slice(0, 12)}...
      </span>
    </div>
  );
}
