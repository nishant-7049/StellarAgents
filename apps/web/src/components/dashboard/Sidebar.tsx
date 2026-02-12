"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/app", label: "Dashboard", icon: "◈" },
  { href: "/app/vault", label: "Vault", icon: "🔐" },
  { href: "/app/agents", label: "Agents", icon: "🤖" },
  { href: "/app/chat", label: "Chat", icon: "💬" },
  { href: "/app/register", label: "Register", icon: "+" },
  { href: "/app/history", label: "History", icon: "📋" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-full w-56 border-r border-[var(--border)] bg-[var(--bg-secondary)] p-4 flex flex-col">
      <Link href="/" className="text-lg font-bold gradient-text mb-8 px-3">AgentNet</Link>
      <nav className="flex flex-col gap-1">
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-indigo-600/20 text-indigo-300"
                : "text-[var(--text-secondary)] hover:text-white hover:bg-white/5"
            )}>
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-3 py-2">
        <div className="text-xs text-[var(--text-secondary)]">Stellar Testnet</div>
      </div>
    </aside>
  );
}
