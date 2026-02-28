import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";

interface FooterLink { label: string; href: string; external?: boolean; }
interface FooterCol  { heading: string; links: FooterLink[]; }

const cols: FooterCol[] = [
  {
    heading: "Product",
    links: [
      { label: "Explorer",       href: "/explorer" },
      { label: "Vault Manager",  href: "/vault" },
      { label: "Agent Registry", href: "/agents" },
      { label: "Live Demo",      href: "/chat" },
      { label: "Credits",        href: "/credits" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "Documentation",    href: "https://agenticoceandocs.vercel.app/",                             external: true },
      { label: "defi-agent SDK",   href: "https://agenticoceandocs.vercel.app/#/sdk/defi-agent/overview",   external: true },
      { label: "vault SDK",        href: "https://agenticoceandocs.vercel.app/#/sdk/vault/overview",         external: true },
      { label: "x402-stellar SDK", href: "https://agenticoceandocs.vercel.app/#/sdk/x402-stellar/overview", external: true },
    ],
  },
  {
    heading: "Ecosystem",
    links: [
      { label: "Blend Protocol",  href: "https://blend.capital/",   external: true },
      { label: "Soroswap",        href: "https://soroswap.finance/", external: true },
      { label: "Ondo Finance",    href: "https://ondo.finance/",    external: true },
      { label: "DeFiLlama",       href: "https://defillama.com/",   external: true },
      { label: "Stellar Network", href: "https://stellar.org/",     external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg0)]">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand column */}
          <div>
            <Link href="/" className="inline-flex mb-4">
              <Image
                src="/logo.png"
                alt="AgenticOcean"
                width={56}
                height={56}
                className="object-contain"
              />
            </Link>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-5">
              Autonomous AI agents for DeFi yield optimization on Stellar. Smart vaults,
              x402 payments, and on-chain agent identity.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[12px] text-[var(--text-muted)]">Live on Stellar Mainnet</span>
            </div>
          </div>

          {/* Link columns */}
          {cols.map(col => (
            <div key={col.heading}>
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-4">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map(link => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--text-muted)]">
            © 2026 AgenticOcean. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="https://stellar.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Built on Stellar
            </a>
            <a
              href="https://agenticoceandocs.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
