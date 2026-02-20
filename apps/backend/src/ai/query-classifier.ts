/**
 * Query Classifier - Determines intent and routes to appropriate handler
 */

export type QueryIntent =
  | "greeting"
  | "portfolio_status"
  | "protocol_info"
  | "market_data"
  | "defi_education"
  | "strategy_request"
  | "comparison"
  | "general_question";

export interface ClassifiedQuery {
  intent: QueryIntent;
  entities: {
    protocols?: string[];
    amount?: number;
    riskLevel?: string;
  };
}

const GREETINGS = ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "yo", "sup"];
const PROTOCOL_KEYWORDS = ["blend", "soroswap", "ondo", "usdy", "defindex", "aquarius"];
const STRATEGY_KEYWORDS = ["strategy", "allocate", "portfolio", "invest", "yield", "apy", "best", "maximize", "optimize"];
const COMPARISON_KEYWORDS = ["compare", "versus", "vs", "difference", "better", "which"];
const EDUCATION_KEYWORDS = ["what is", "explain", "how does", "define", "meaning", "learn"];
const ACCOUNT_STATUS_KEYWORDS = ["status", "balance", "deposit", "vault", "account", "show", "see", "check", "view", "my"];
const PORTFOLIO_KEYWORDS = [
  "my portfolio", "my funds", "my positions", "my balance", "my apy", "my yield",
  "how much am i earning", "how much have i earned", "my pnl", "my gains", "my losses",
  "what am i earning", "current apy", "deployed", "track my", "show my funds",
  "rebalance my", "withdraw and redeposit", "how are my funds", "my investments",
];

export function classifyQuery(query: string): ClassifiedQuery {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  // Greeting
  if (words.some(word => GREETINGS.includes(word)) && words.length <= 3) {
    return { intent: "greeting", entities: {} };
  }

  // Portfolio status — user asking about their own deployed funds/APY/PnL
  if (PORTFOLIO_KEYWORDS.some(k => lowerQuery.includes(k))) {
    return { intent: "portfolio_status", entities: {} };
  }

  // Account/vault status queries (should be free)
  const hasAccountKeywords = ACCOUNT_STATUS_KEYWORDS.filter(k => lowerQuery.includes(k)).length >= 2;
  if (hasAccountKeywords && !STRATEGY_KEYWORDS.some(k => lowerQuery.includes(k))) {
    return { intent: "general_question", entities: {} };
  }

  // Extract entities
  const entities: ClassifiedQuery["entities"] = {};

  // Extract protocols
  const protocols = PROTOCOL_KEYWORDS.filter(p => lowerQuery.includes(p));
  if (protocols.length > 0) entities.protocols = protocols;

  // Extract amount
  const amountMatch = lowerQuery.match(/\$?(\d+(?:,\d{3})*(?:\.\d+)?)\s*(usdc|usd|dollars?)?/i);
  if (amountMatch) entities.amount = parseFloat(amountMatch[1].replace(/,/g, ""));

  // Comparison
  if (COMPARISON_KEYWORDS.some(k => lowerQuery.includes(k))) {
    return { intent: "comparison", entities };
  }

  // Protocol-specific education (e.g., "How does Blend work?")
  // This should be protocol_info, not defi_education
  if (protocols.length > 0 && EDUCATION_KEYWORDS.some(k => lowerQuery.includes(k))) {
    return { intent: "protocol_info", entities };
  }

  // General DeFi education (no specific protocol mentioned)
  if (EDUCATION_KEYWORDS.some(k => lowerQuery.includes(k))) {
    return { intent: "defi_education", entities };
  }

  // Protocol info
  if (protocols.length > 0 && !STRATEGY_KEYWORDS.some(k => lowerQuery.includes(k))) {
    return { intent: "protocol_info", entities };
  }

  // Strategy request
  if (STRATEGY_KEYWORDS.some(k => lowerQuery.includes(k)) || entities.amount) {
    return { intent: "strategy_request", entities };
  }

  // Market data
  if (lowerQuery.match(/\b(apy|apr|rate|yield)\b/) && !STRATEGY_KEYWORDS.some(k => lowerQuery.includes(k))) {
    return { intent: "market_data", entities };
  }

  // Default to general question
  return { intent: "general_question", entities };
}

export function extractRiskLevel(query: string): "low" | "moderate" | "high" {
  const lowerQuery = query.toLowerCase();
  if (lowerQuery.match(/\b(low|safe|conservative|stable|secure)\b/)) return "low";
  if (lowerQuery.match(/\b(high|aggressive|risky|max|maximum)\b/)) return "high";
  return "moderate";
}
