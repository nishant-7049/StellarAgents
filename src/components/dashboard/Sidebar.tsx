"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Search, Shield, Bot, Zap, ChevronRight, Sparkles } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useCredits } from "@/hooks/useCredits";

const navItems = [
  { href: "/explorer", label: "Explorer", icon: Search },
  { href: "/vault",    label: "Vault",    icon: Shield },
  { href: "/agents",   label: "Agents",   icon: Bot    },
  { href: "/credits",  label: "Credits",  icon: Zap    },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { address } = useWallet();
  const { credits } = useCredits(address);

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col border-r border-[var(--border)] bg-[var(--bg1)] transition-all duration-200 z-30"
      style={{ width: collapsed ? 72 : 260 }}
    >
      {/* Logo */}
      <div className={clsx(
        "flex items-center py-4 border-b border-[var(--border)]",
        collapsed ? "justify-center px-0" : "px-4"
      )}>
        <Link href="/">
          {collapsed ? (
            <Image
              src="/logo.png"
              alt="AgenticOcean"
              width={36}
              height={36}
              className="rounded-[8px] object-contain"
            />
          ) : (
            <Image
              src="/logo.png"
              alt="AgenticOcean"
              width={220}
              height={56}
              className="rounded-[8px] object-contain w-full max-w-[220px] h-auto"
            />
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-3 mt-4 flex-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                "flex items-center rounded-[10px] text-[14px] font-medium transition-colors duration-150",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-4 py-2.5",
                isActive
                  ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/25"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface1)] hover:text-[var(--text-primary)]"
              )}
            >
              <item.icon className={clsx("w-4 h-4 flex-shrink-0", isActive && "text-[var(--accent)]")} />
              {!collapsed && item.label}
            </Link>
          );
        })}

        {/* Try our Agent CTA */}
        {!collapsed && (
          <Link
            href="/chat"
            className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-[12px]
              bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)]
              shadow-[0_4px_14px_rgba(31,102,255,0.28)]
              hover:shadow-[0_4px_20px_rgba(31,102,255,0.44)]
              text-white text-[13px] font-semibold transition-shadow"
          >
            <Sparkles className="w-4 h-4" />
            Live Agent Demo
          </Link>
        )}
        {collapsed && (
          <Link
            href="/chat"
            title="Live Agent Demo"
            className="mt-3 flex justify-center items-center h-10 w-10 mx-auto rounded-[10px]
              bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)]
              shadow-[0_2px_8px_rgba(31,102,255,0.28)]"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </Link>
        )}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto">
        {!collapsed && (
          <a
            href="https://agenticoceandocs.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-5 py-2 text-[11px] text-[var(--text-muted)]
              hover:text-[var(--text-secondary)] transition-colors"
          >
            SDK Docs
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none">
              <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </a>
        )}

        <div className="border-t border-[var(--border)]">
          {!collapsed && credits ? (
            <Link
              href="/credits"
              className="flex items-start gap-2.5 px-4 py-4 hover:bg-[var(--surface1)] transition-colors"
            >
              <Zap className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-[var(--text-muted)] capitalize">{credits.plan || "Free"} Plan</p>
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {credits.balance?.toLocaleString()} cr
                </p>
              </div>
            </Link>
          ) : collapsed ? (
            <Link
              href="/credits"
              title="Credits"
              className="flex justify-center items-center h-12 hover:bg-[var(--surface1)] transition-colors"
            >
              <Zap className="w-4 h-4 text-[var(--accent)]" />
            </Link>
          ) : (
            <div className="px-4 py-4">
              <p className="text-[11px] text-[var(--text-muted)]">Connect wallet for credits</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle button */}
      <button
        onClick={onToggle}
        className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full
          bg-[var(--bg1)] border border-[var(--border)]
          flex items-center justify-center hover:bg-[var(--surface1)]
          transition-colors shadow-sm z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <ChevronRight className={clsx(
          "w-3 h-3 text-[var(--text-muted)] transition-transform duration-200",
          !collapsed && "rotate-180"
        )} />
      </button>
    </aside>
  );
}
