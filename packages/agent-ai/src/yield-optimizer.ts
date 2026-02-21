import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
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
  PortfolioSnapshot,
  LoggerLike,
} from "./types.js";

type AIProvider =
  | { type: "anthropic"; client: Anthropic }
  | { type: "gemini";    client: GoogleGenerativeAI }
  | { type: "groq";      client: OpenAI }
  | { type: "xai";       client: OpenAI };

function detectProvider(apiKey: string): AIProvider {
  if (apiKey.startsWith("sk-ant-")) {
    return { type: "anthropic", client: new Anthropic({ apiKey }) };
  }
  if (apiKey.startsWith("AIza")) {
    return { type: "gemini", client: new GoogleGenerativeAI(apiKey) };
  }
  if (apiKey.startsWith("gsk_")) {
    return { type: "groq", client: new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" }) };
  }
  if (apiKey.startsWith("xai-")) {
    return { type: "xai", client: new OpenAI({ apiKey, baseURL: "https://api.x.ai/v1" }) };
  }
  // Unknown prefix — try as Anthropic
  return { type: "anthropic", client: new Anthropic({ apiKey }) };
}

/**
 * AI-powered yield optimization engine.
 *
 * Set a single `aiApiKey` in config — the provider is auto-detected:
 *   sk-ant-*  → Anthropic Claude
 *   AIza*     → Google Gemini
 *   gsk_*     → Groq / Llama
 *   xai-*     → xAI Grok
 */
export class YieldOptimizer {
  private provider: AIProvider | null;
  private blendClient: BlendClient;
  private soroswapClient: SoroswapClient;
  private rebalancer: Rebalancer | null;
  private usdcAddress: string;
  private log: LoggerLike;
  private config: AgentAIConfig;

  constructor(config: AgentAIConfig, rebalancer?: Rebalancer) {
    this.config = config;
    this.provider = config.aiApiKey ? detectProvider(config.aiApiKey) : null;
    this.blendClient = new BlendClient(config);
    this.soroswapClient = new SoroswapClient(config);
    this.rebalancer = rebalancer ?? null;
    this.usdcAddress = config.usdcAddress || "";
    this.log = config.logger ?? console;
    if (this.provider) {
      this.log.info(`AI provider: ${this.provider.type}`);
    }
  }

  getBlendClient(): BlendClient { return this.blendClient; }
  getSoroswapClient(): SoroswapClient { return this.soroswapClient; }

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

    let strategy;
    if (this.provider) {
      try {
        strategy = await this.callProvider(this.provider, query, poolContext, riskTolerance, amount);
        this.log.info(`Strategy generated via ${this.provider.type}`);
      } catch (err) {
        this.log.warn(`${this.provider.type} failed, using hardcoded fallback`, { error: String(err).slice(0, 150) });
        strategy = this.fallbackStrategy(riskTolerance, amount);
      }
    } else {
      strategy = this.fallbackStrategy(riskTolerance, amount);
    }

    if (this.rebalancer && strategy.strategies.length > 0) {
      let snapshot: PortfolioSnapshot | null = null;
      if (this.config.vaultContract) {
        try {
          snapshot = await this.rebalancer.readCurrentPortfolio(this.config.vaultContract);
        } catch (err) {
          this.log.warn("Could not read current portfolio, using currentPct: 0", { error: err });
        }
      }
      this.rebalancer.setTargetAllocation(
        strategy.strategies.map(s => {
          const protocol = s.protocol.toLowerCase().includes("blend") ? "blend" : "soroswap";
          const pos = snapshot?.positions.find(p => p.protocol === protocol);
          return { protocol, asset: this.usdcAddress, targetPct: s.allocation_pct, currentPct: pos?.pct ?? 0 };
        })
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

  private async callProvider(
    provider: AIProvider,
    query: string, poolContext: string, risk: string, amount?: number,
  ): Promise<{ strategies: YieldStrategy[]; total_estimated_apy: number; summary: string }> {
    const userPrompt = buildUserPrompt(query, poolContext, risk, amount);

    if (provider.type === "anthropic") {
      const res = await provider.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const text = res.content[0].type === "text" ? res.content[0].text : "";
      return this.parseJson(text);
    }

    if (provider.type === "gemini") {
      const model = provider.client.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
      const res = await model.generateContent(`${SYSTEM_PROMPT}\n\n${userPrompt}`);
      return this.parseJson(res.response.text());
    }

    // groq or xai — both OpenAI-compatible
    const model = provider.type === "xai" ? "grok-3-mini" : "llama-3.3-70b-versatile";
    const res = await (provider.client as OpenAI).chat.completions.create({
      model,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
    return this.parseJson(res.choices[0]?.message?.content ?? "");
  }

  private parseJson(
    text: string,
  ): { strategies: YieldStrategy[]; total_estimated_apy: number; summary: string } {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}") + 1;
    if (start === -1 || end === 0) throw new Error("No JSON in response");
    return JSON.parse(text.slice(start, end));
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
