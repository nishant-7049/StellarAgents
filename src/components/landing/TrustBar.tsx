const integrations = [
  { name: "Stellar",        detail: "Blockchain" },
  { name: "Blend Protocol", detail: "12.6% APY" },
  { name: "Soroswap",       detail: "AMM DEX" },
  { name: "Ondo Finance",   detail: "RWA Yields" },
  { name: "DeFiLlama",      detail: "APY Data" },
  { name: "x402",           detail: "Payments" },
];

export function TrustBar() {
  return (
    <section className="border-y border-[var(--border)] bg-white py-5 px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] shrink-0 whitespace-nowrap">
            Integrated with
          </span>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-7 gap-y-2">
            {integrations.map(p => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">{p.name}</span>
                <span className="text-[12px] text-[var(--text-muted)]">· {p.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
