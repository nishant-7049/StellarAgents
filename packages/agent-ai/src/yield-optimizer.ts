import Anthropic from "@anthropic-ai/sdk";
import { BlendClient } from "./blend-client.js";
import { SoroswapClient } from "./soroswap-client.js";
import { Rebalancer } from "./rebalancer.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";
import type {
  AgentAIConfig,
  YieldStrategy,
  StrategyResponse,
  BlendPoolData,
  PoolData,
  LoggerLike,
} from "./types.js";

/**
 * AI-powered yield optimization engine.
 *
 * Pipeline:
 * 1. Fetch live data from Blend (APYs, utilization) + Soroswap (swap rates)
 * 2. Format as structured context for Claude
 * 3. Claude generates allocation strategy based on risk tolerance
 * 4. Parse + validate strategy
 * 5. Optionally trigger rebalancer with new targets
 */
export class YieldOptimizer {
  private anthropic: Anthropic | null;
  private blendClient: BlendClient;
  private soroswapClient: SoroswapClient;
  private rebalancer: Rebalancer | null;
  private usdcAddress: string;
  private log: LoggerLike;

  constructor(config: AgentAIConfig, rebalancer?: Rebalancer) {
    this.anthropic = config.anthropicApiKey
      ? new Anthropic({ apiKey: config.anthropicApiKey })
      : null;
    this.blendClient = new BlendClient(config);
    this.soroswapClient = new SoroswapClient(config);
    this.rebalancer = rebalancer ?? null;
    this.usdcAddress = config.usdcAddress || "";
    this.log = config.logger ?? console;
  }

  /** Get the internal BlendClient instance. */
  getBlendClient(): BlendClient {
    return this.blendClient;
  }

  /** Get the internal SoroswapClient instance. */
  getSoroswapClient(): SoroswapClient {
    return this.soroswapClient;
  }

  async optimize(
    query: string,
    riskTolerance: string = "moderate",
    amount?: number,
  ): Promise<StrategyResponse> {
    const [blendData, soroswapPools] = await Promise.all([
      this.blendClient.loadPool(),
      this.soroswapClient.getPools(),
    ]);
    const poolContext = this.formatPoolContext(blendData, soroswapPools);
    const strategy = this.anthropic
      ? await this.generateWithClaude(query, poolContext, riskTolerance, amount)
      : this.fallbackStrategy(riskTolerance, amount);

    if (this.rebalancer && strategy.strategies.length > 0) {
      this.rebalancer.setTargetAllocation(
        strategy.strategies.map(s => ({
          protocol: s.protocol.toLowerCase().includes("blend") ? "blend" : "soroswap",
          asset: this.usdcAddress,
          targetPct: s.allocation_pct,
          currentPct: 0,
        }))
      );
    }

    return {
      query,
      risk_tolerance: riskTolerance,
      amount_usdc: amount,
      strategies: strategy.strategies,
      total_estimated_apy: strategy.total_estimated_apy,
      summary: strategy.summary,
      data_sources: {
        blend_pools: blendData.reserves.length,
        soroswap_pools: soroswapPools.length,
        rwa_sources: 2,
      },
      disclaimer: "APY estimates based on current rates. Not financial advice. DYOR.",
    };
  }

  private async generateWithClaude(
    query: string, poolContext: string, risk: string, amount?: number,
  ): Promise<{ strategies: YieldStrategy[]; total_estimated_apy: number; summary: string }> {
    const userPrompt = buildUserPrompt(query, poolContext, risk, amount);
    const response = await this.anthropic!.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}") + 1;
      return JSON.parse(text.slice(start, end));
    } catch {
      this.log.error("Failed to parse Claude response", { text });
      return this.fallbackStrategy(risk, amount);
    }
  }

  private formatPoolContext(blend: BlendPoolData, soroswap: PoolData[]): string {
    const lines: string[] = [];
    lines.push("=== BLEND PROTOCOL (Lending) ===");
    for (const r of blend.reserves) {
      lines.push(`  ${r.symbol}: Supply APY ${r.supplyApy.toFixed(1)}% | Borrow APY ${r.borrowApy.toFixed(1)}% | Utilization ${(r.utilization * 100).toFixed(0)}%`);
    }
    lines.push("\n=== SOROSWAP (AMM DEX) ===");
    for (const p of soroswap) {
      lines.push(`  ${p.token0}/${p.token1}: LP APY ~${p.apy}%`);
    }
    lines.push("\n=== RWA YIELDS ===");
    lines.push("  Ondo USDY: 4.8% (US Treasury-backed, lowest risk)");
    lines.push("  Centrifuge deJTRSY: 4.5% (Institutional treasuries)");
    lines.push("\n=== DEFINDEX VAULTS ===");
    lines.push("  Auto-Compound Blend Vault: ~9.1% (compounds Blend + BLND rewards)");
    lines.push("  Multi-Strategy Vault: ~11.3% (Blend + Soroswap + Aquarius)");
    return lines.join("\n");
  }

  private fallbackStrategy(
    risk: string, _amount?: number,
  ): { strategies: YieldStrategy[]; total_estimated_apy: number; summary: string } {
    const strategies: Record<string, { strategies: YieldStrategy[]; total_estimated_apy: number; summary: string }> = {
      low: {
        strategies: [
          { protocol: "Ondo USDY", action: "Hold USDY", allocation_pct: 40, estimated_apy: 4.8, risk_level: "low", details: "US Treasury-backed" },
          { protocol: "Blend Fixed V2", action: "Supply USDC", allocation_pct: 40, estimated_apy: 7.2, risk_level: "low", details: "Immutable pool, backstop protected" },
          { protocol: "Soroswap USDC/EURC", action: "Provide LP", allocation_pct: 20, estimated_apy: 3.8, risk_level: "low", details: "Stablecoin pair, minimal IL" },
        ],
        total_estimated_apy: 5.6,
        summary: "Conservative strategy: Treasury yields + lending + stable LP.",
      },
      moderate: {
        strategies: [
          { protocol: "DeFindex Auto-Compound", action: "Deposit vault", allocation_pct: 35, estimated_apy: 9.1, risk_level: "moderate", details: "Auto-compounds Blend yields" },
          { protocol: "Blend Fixed V2", action: "Supply USDC", allocation_pct: 30, estimated_apy: 7.2, risk_level: "low", details: "Stable base yield" },
          { protocol: "Ondo USDY", action: "Hold USDY", allocation_pct: 20, estimated_apy: 4.8, risk_level: "low", details: "Safety allocation" },
          { protocol: "Soroswap USDC/XLM", action: "Provide LP", allocation_pct: 15, estimated_apy: 12.5, risk_level: "high", details: "Yield kicker, IL monitored" },
        ],
        total_estimated_apy: 8.1,
        summary: "Balanced: lending core + vault optimization + small LP kicker.",
      },
      high: {
        strategies: [
          { protocol: "DeFindex Multi-Strategy", action: "Deposit vault", allocation_pct: 35, estimated_apy: 11.3, risk_level: "high", details: "Blend + Soroswap + Aquarius" },
          { protocol: "Soroswap USDC/XLM", action: "Provide LP", allocation_pct: 30, estimated_apy: 12.5, risk_level: "high", details: "Strong fee revenue" },
          { protocol: "Blend YieldBlox V2", action: "Supply USDC", allocation_pct: 25, estimated_apy: 8.5, risk_level: "moderate", details: "BLND rewards boost" },
          { protocol: "Ondo USDY", action: "Hold USDY", allocation_pct: 10, estimated_apy: 4.8, risk_level: "low", details: "Safety base" },
        ],
        total_estimated_apy: 10.4,
        summary: "Aggressive: maximizing yield through LP + multi-strategy vaults.",
      },
    };
    return strategies[risk] || strategies.moderate;
  }
}
