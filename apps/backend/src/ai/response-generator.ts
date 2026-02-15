/**
 * Response Generator - Creates contextual responses using Claude API or smart fallbacks
 */
import Anthropic from "@anthropic-ai/sdk";
import { ClassifiedQuery } from "./query-classifier.js";
import { blendClient } from "../defi/blend-client.js";
import { soroswapClient } from "../defi/soroswap-client.js";
import { config } from "../config.js";

const anthropic = config.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  : null;

const SYSTEM_CONTEXT = `You are a friendly, expert DeFi yield optimizer AI for Stellar blockchain. You help users:
- Find optimal yield strategies across Blend, Soroswap, Ondo USDY, and DeFindex
- Understand DeFi concepts in simple terms
- Compare protocols objectively
- Navigate risk/reward tradeoffs

Current Stellar DeFi rates (testnet):
• Blend USDC lending: ~7.2% APY (low risk, backstop protected)
• Soroswap USDC/XLM LP: ~12.5% APY (higher risk, impermanent loss)
• Ondo USDY: ~4.8% APY (lowest risk, US Treasury-backed)
• DeFindex Auto-Compound: ~9.1% APY (automated, diversified)
• DeFindex Multi-Strategy: ~11.3% APY (aggressive, multi-protocol)

Be concise, helpful, and conversational. Use emojis sparingly. If asked for a strategy, you'll defer to the strategy engine.`;

async function callClaude(prompt: string): Promise<string | null> {
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 500,
      system: SYSTEM_CONTEXT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return text;
  } catch (err) {
    console.error("Claude API error:", err);
    return null;
  }
}

export async function generateGreeting(): Promise<{ type: "text"; content: string }> {
  const claudeResponse = await callClaude("User just said 'hi'. Give a friendly, brief greeting and mention you can help with DeFi yield strategies.");

  if (claudeResponse) {
    return { type: "text", content: claudeResponse };
  }

  // Fallback with more variety
  const time = new Date().getHours();
  const timeGreeting = time < 12 ? "Good morning" : time < 18 ? "Good afternoon" : "Good evening";

  const responses = [
    `${timeGreeting}! I'm here to help you navigate Stellar DeFi. Want to explore yield strategies, learn about protocols, or check current APYs?`,
    `Hey! Looking to optimize your yields? I can help you find the best strategies across Blend, Soroswap, and other Stellar protocols. What's on your mind?`,
    `Hi there! Whether you're hunting for yields, comparing protocols, or just curious about DeFi - I've got you covered. What would you like to know?`,
  ];
  return { type: "text", content: responses[Math.floor(Math.random() * responses.length)] };
}

export async function generateProtocolInfo(query: ClassifiedQuery): Promise<{ type: "text"; content: string }> {
  const protocols = query.entities.protocols || [];

  if (protocols.length > 0) {
    const prompt = `User is asking about ${protocols.join(", ")} protocol(s) on Stellar. Explain what ${protocols.length === 1 ? "it is" : "they are"}, key features, current APY, and who should use ${protocols.length === 1 ? "it" : "them"}. Be informative but concise (2-3 paragraphs max).`;

    const claudeResponse = await callClaude(prompt);
    if (claudeResponse) {
      return { type: "text", content: claudeResponse };
    }
  }

  // Enhanced fallback with live data and detailed explanations
  try {
    const blendData = await blendClient.loadPool();
    const soroswapData = await soroswapClient.getPools();

    if (protocols.includes("blend")) {
      return {
        type: "text",
        content: `**How Blend Works:**

Blend is a lending protocol where you deposit assets (like USDC) into a pool, and borrowers take loans from it. You earn interest from those loans.

**Current rates:** USDC lending earns ${blendData.reserves[0]?.supplyApy.toFixed(1)}% APY right now. The rate fluctuates based on how much is borrowed (utilization).

**Safety:** Backstop protection means even if borrowers default, lenders are protected. The contracts are immutable (no admin can rug pull).

**Best for:** Conservative investors who want steady yields without impermanent loss. You deposit USDC, you get USDC back + interest.`,
      };
    }

    if (protocols.includes("soroswap")) {
      return {
        type: "text",
        content: `**How Soroswap Works:**

Soroswap is an automated market maker (AMM) where you provide liquidity to trading pairs. When people trade, you earn a share of the fees.

**Example:** Provide USDC + XLM to a pool. Traders swap between them, you earn fees from each trade. Current pairs yield around ${soroswapData[0]?.apy.toFixed(1)}% APY.

**The catch:** Impermanent loss - if token prices change a lot, you might've been better off just holding. But high trading volume and fees can offset this.

**Best for:** Active DeFi users who understand IL and want higher yields than lending.`,
      };
    }

    if (protocols.includes("ondo")) {
      return {
        type: "text",
        content: `**How Ondo USDY Works:**

USDY is a tokenized version of US Treasury bonds. When you hold USDY, you're essentially holding short-term T-bills but in crypto form.

**Returns:** ~4.8% APY, tracking whatever the Fed pays on Treasuries. It's not "DeFi yield" - it's real-world government debt.

**Safety:** Fully regulated, audited, and backed 1:1 by actual US Treasuries. Lowest risk option in crypto.

**Best for:** Risk-averse investors who want stable, predictable yields with minimal smart contract risk.`,
      };
    }

    if (protocols.includes("defindex")) {
      return {
        type: "text",
        content: `**How DeFindex Works:**

DeFindex runs automated vaults that execute yield strategies for you. Instead of manually moving funds between protocols, the vault does it.

**Two main vaults:**
• Auto-Compound (~9.1% APY): Takes Blend yields and BLND rewards, compounds them automatically
• Multi-Strategy (~11.3% APY): Spreads across Blend, Soroswap, and other protocols

**Benefits:** Professional management, gas savings from batching, set-and-forget passive income.

**Best for:** Passive investors who want optimized yields without constant monitoring.`,
      };
    }
  } catch {}

  return {
    type: "text",
    content: protocols.length === 0
      ? "I can explain how Blend (lending), Soroswap (DEX), Ondo USDY (RWA), or DeFindex (vaults) work. Which one interests you?"
      : `Want to know how ${protocols.join(", ")} work${protocols.length === 1 ? "s" : ""}? I can break down the mechanics, risks, and who should use ${protocols.length === 1 ? "it" : "them"}!`,
  };
}

export async function generateMarketData(): Promise<{ type: "text"; content: string; data?: any }> {
  try {
    const blend = await blendClient.loadPool();
    const soroswap = await soroswapClient.getPools();

    const content = `📊 **Current Stellar DeFi Rates** (Testnet)

**Lending (Blend Protocol)**
• USDC Supply: ${blend.reserves[0]?.supplyApy.toFixed(2)}% APY
• XLM Supply: ${blend.reserves[1]?.supplyApy.toFixed(2)}% APY
• Pool Utilization: ${(blend.reserves[0]?.utilization * 100).toFixed(0)}%

**Liquidity Pools (Soroswap)**
• USDC/XLM: ~${soroswap[0]?.apy.toFixed(1)}% APY
• Trading fees + farming rewards

**Real-World Assets**
• Ondo USDY: ~4.8% APY (US Treasuries)
• Centrifuge deJTRSY: ~4.5% APY

**Vaults (DeFindex)**
• Auto-Compound: ~9.1% APY
• Multi-Strategy: ~11.3% APY

💡 Want a personalized allocation strategy? Just ask!`;

    return { type: "text", content, data: { blend, soroswap } };
  } catch {
    return {
      type: "text",
      content: "Current market rates:\n• Blend USDC: ~7.2% APY\n• Soroswap LP: ~12.5% APY\n• Ondo USDY: ~4.8% APY\n• DeFindex Vaults: ~9-11% APY",
    };
  }
}

export async function generateComparison(query: ClassifiedQuery): Promise<{ type: "text"; content: string }> {
  const protocols = query.entities.protocols || [];

  if (protocols.length >= 2) {
    const prompt = `User wants to compare ${protocols.join(" and ")} protocols on Stellar. Give an objective comparison covering: APY, risk level, how they work, and who should use each. Be balanced and helpful (2-3 paragraphs).`;

    const claudeResponse = await callClaude(prompt);
    if (claudeResponse) {
      return { type: "text", content: claudeResponse };
    }
  }

  // Dynamic fallback with live data
  try {
    const blendData = await blendClient.loadPool();
    const soroswapData = await soroswapClient.getPools();

    if (protocols.includes("blend") && protocols.includes("soroswap")) {
      return {
        type: "text",
        content: `**Blend vs Soroswap**

Blend offers ${blendData.reserves[0]?.supplyApy.toFixed(1)}% APY for lending USDC - low risk, no impermanent loss, withdraw anytime. Great for stability.

Soroswap LP pairs yield around ${soroswapData[0]?.apy.toFixed(1)}% APY from fees + farming. Higher returns but you face IL risk when prices change.

**Bottom line:** Most smart portfolios use both - Blend for your base (60-70%), Soroswap for yield boost (30-40%).`,
      };
    }
  } catch {}

  return {
    type: "text",
    content: protocols.length === 0
      ? "I can compare any Stellar protocols! Try: 'Blend vs Soroswap' or 'Compare Ondo and Blend'"
      : `Want to compare ${protocols.join(" and ")}? I can break down APY, risks, and which is best for different goals. What specifically interests you?`,
  };
}

export async function generateEducation(query: string): Promise<{ type: "text"; content: string }> {
  const prompt = `User is asking a DeFi education question: "${query}". Explain the concept clearly and concisely with examples. Make it beginner-friendly but not condescending. 2-3 paragraphs max.`;

  const claudeResponse = await callClaude(prompt);
  if (claudeResponse) {
    return { type: "text", content: claudeResponse };
  }

  // Smarter fallback based on keywords
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.match(/\b(apy|apr|yield|return)\b/)) {
    return {
      type: "text",
      content: `APY (Annual Percentage Yield) is what you earn on your crypto per year, including compounding. Think of it like interest on a savings account, but usually way higher.\n\nExample: Put in $1000 at 10% APY → you'd have $1100 after a year. On Stellar, you can get 5-12% APY depending on risk level.\n\nThe catch? Higher APY usually means higher risk. Blend's 7% is safer than Soroswap's 12% because you don't face impermanent loss.`,
    };
  }

  if (lowerQuery.match(/\b(il|impermanent loss|liquidity)\b/)) {
    return {
      type: "text",
      content: `Impermanent Loss (IL) happens when you provide liquidity to a DEX and token prices change. You lose compared to just holding.\n\nQuick example: You LP $100 USDC + $100 XLM. If XLM 2x's in price, your LP position is worth less than if you'd just held the XLM. That difference is IL.\n\nHow to avoid? Use stable pairs (USDC/EURC), stick to Blend lending (zero IL), or make sure trading fees offset the loss.`,
    };
  }

  return {
    type: "text",
    content: `I can explain any DeFi concept! Try asking specific questions like:\n• "What is APY?"\n• "Explain impermanent loss"\n• "How does Blend work?"\n• "What are the risks?"\n\nOr just ask naturally - "why is Soroswap APY higher than Blend?"`,
  };
}
