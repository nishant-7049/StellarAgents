import { config } from "../config.js";
import { readContractValue } from "../stellar/contract-reader.js";
import { nativeToScVal } from "@stellar/stellar-sdk";

export class AgentService {
  async listAgents(startId: number = 1, limit: number = 10) {
    if (!config.AGENT_REGISTRY_ADDRESS) return [];
    try {
      return await readContractValue(
        config.AGENT_REGISTRY_ADDRESS,
        "list_agents",
        [nativeToScVal(startId, { type: "u32" }), nativeToScVal(limit, { type: "u32" })]
      );
    } catch {
      return [];
    }
  }

  async getAgent(agentId: number) {
    if (!config.AGENT_REGISTRY_ADDRESS) return null;
    try {
      return await readContractValue(
        config.AGENT_REGISTRY_ADDRESS,
        "get_agent",
        [nativeToScVal(agentId, { type: "u32" })]
      );
    } catch {
      return null;
    }
  }
}

export const agentService = new AgentService();
