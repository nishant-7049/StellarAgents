const steps = [
  { step: "1", title: "Connect Wallet", desc: "Link your Freighter wallet on Stellar testnet" },
  { step: "2", title: "Create Vault", desc: "Deploy a smart vault and deposit USDC" },
  { step: "3", title: "Register Agent", desc: "Add an AI agent with spending limits" },
  { step: "4", title: "Agent Pays", desc: "Agent queries services, pays via x402 automatically" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-6 bg-[var(--bg-secondary)]">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold mb-12">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-4">
          {steps.map(s => (
            <div key={s.step} className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-lg font-bold mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-[var(--text-secondary)]">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
