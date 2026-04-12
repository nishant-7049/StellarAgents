"use client";
import Link from "next/link";
import { Zap } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import clsx from "clsx";

interface CreditMeterProps {
  wallet: string | null;
  compact?: boolean;
}

export function CreditMeter({ wallet, compact = false }: CreditMeterProps) {
  const { credits } = useCredits(wallet);

  if (!wallet || !credits) {
    return null;
  }

  const usagePct = credits.monthlyQuota > 0
    ? Math.min(100, (credits.usedThisMonth / credits.monthlyQuota) * 100)
    : 0;

  const barColor = usagePct > 80
    ? "bg-red-500"
    : usagePct > 50
      ? "bg-amber-500"
      : "bg-indigo-500";

  if (compact) {
    return (
      <Link href="/credits" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-amber-400">{credits.balance}</span>
        <span className="text-xs text-[var(--text-secondary)]">credits</span>
      </Link>
    );
  }

  return (
    <Link href="/credits" className="block px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-[var(--text-secondary)] capitalize">{credits.plan}</span>
        </div>
        <span className="text-xs font-medium text-amber-400">{credits.balance} credits</span>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all", barColor)}
          style={{ width: `${usagePct}%` }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-[var(--text-secondary)]">{credits.usedThisMonth} used</span>
        <span className="text-[10px] text-[var(--text-secondary)]">{credits.monthlyQuota}/mo</span>
      </div>
    </Link>
  );
}
