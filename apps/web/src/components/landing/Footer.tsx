export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-8 px-6">
      <div className="mx-auto max-w-5xl flex items-center justify-between">
        <div className="text-sm text-[var(--text-secondary)]">
          AgentNet Stellar — Hackathon Feb 2026
        </div>
        <div className="flex gap-4 text-sm text-[var(--text-secondary)]">
          <span>Stellar Testnet</span>
          <span>•</span>
          <span>SDF Issue #633</span>
        </div>
      </div>
    </footer>
  );
}
