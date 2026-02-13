import { nativeToScVal } from "@stellar/stellar-sdk";
import { ContractReader } from "./contract-reader.js";
import type { StellarClientConfig, AgentInfo, LoggerLike } from "./types.js";

/**
 * Read-only client for the AgentRegistry contract.
 */
export class AgentRegistry {
  private reader: ContractReader;
  private registryAddress: string;

  constructor(registryAddress: string, config: StellarClientConfig, logger?: LoggerLike) {
    this.registryAddress = registryAddress;
    this.reader = new ContractReader(config, logger);
  }

  /** List active agents starting from startId, up to limit. */
  async listAgents(startId: number = 1, limit: number = 10): Promise<AgentInfo[]> {
    const result = await this.reader.readContractValue(
      this.registryAddress,
      "list_agents",
      [nativeToScVal(startId, { type: "u32" }), nativeToScVal(limit, { type: "u32" })],
    );
    return result || [];
  }

  /** Get a specific agent by ID. */
  async getAgent(agentId: number): Promise<AgentInfo | null> {
    return await this.reader.readContractValue(
      this.registryAddress,
      "get_agent",
      [nativeToScVal(agentId, { type: "u32" })],
    );
  }

  /** Get the agent ID registered by a given owner address. */
  async getAgentByOwner(owner: string): Promise<number | null> {
    return await this.reader.readContractValue(
      this.registryAddress,
      "get_agent_by_owner",
      [nativeToScVal(owner, { type: "address" })],
    );
  }

  /** Get the total number of active agents. */
  async getAgentCount(): Promise<number> {
    const count = await this.reader.readContractValue(this.registryAddress, "agent_count");
    return count || 0;
  }
}
