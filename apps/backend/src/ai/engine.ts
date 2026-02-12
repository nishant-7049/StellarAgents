import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { logger } from "../logger.js";

const anthropic = config.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  : null;

export async function queryAI(systemPrompt: string, userMessage: string): Promise<string> {
  if (!anthropic) {
    logger.warn("No ANTHROPIC_API_KEY set, returning mock response");
    return '{"strategies":[],"total_estimated_apy":0,"summary":"AI not configured"}';
  }
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}
