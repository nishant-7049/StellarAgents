"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutDashboard, Shield, Bot, MessageSquare, UserPlus, History } from "lucide-react";

const navItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/vault", label: "Vault", icon: Shield },
  { href: "/app/agents", label: "Agents", icon: Bot },
  { href: "/app/chat", label: "Chat", icon: MessageSquare },
  { href: "/app/register", label: "Register", icon: UserPlus },
  { href: "/app/history", label: "History", icon: History },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-full w-56 border-r border-[var(--border)] bg-[var(--bg-secondary)] p-4 flex flex-col">
      <Link href="/" className="text-lg font-bold gradient-text mb-8 px-3">AgentNet</Link>
      <nav className="flex flex-col gap-1">
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                isActive
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5 hover:translate-x-0.5"
              )}>
              <item.icon className={clsx("w-4 h-4", isActive && "text-indigo-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Stellar Testnet
        </div>
      </div>
    </aside>
  );
}
