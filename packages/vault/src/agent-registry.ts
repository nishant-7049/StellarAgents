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

  /** List active agents starting from token ID, up to limit.
   *  Falls back to per-ID fetching if the contract's list_agents panics. */
  async listAgents(startTokenId: number = 1, limit: number = 10): Promise<AgentInfo[]> {
    const result = await this.reader.readContractValue(
      this.registryAddress,
      "list_agents",
      [nativeToScVal(BigInt(startTokenId), { type: "u64" }), nativeToScVal(limit, { type: "u32" })],
    );
    if (result !== null) return result;

    // Fallback: fetch agents individually using next_token_id + get_agent
    const nextId: bigint | null = await this.reader.readContractValue(
      this.registryAddress,
      "next_token_id",
    );
    if (!nextId) return [];

    const end = Math.min(Number(nextId) - 1, startTokenId - 1 + limit);
    const fetches = [];
    for (let id = startTokenId; id <= end; id++) {
      fetches.push(this.getAgent(id));
    }
    const agents = await Promise.all(fetches);
    return agents.filter((a): a is AgentInfo => a !== null && (a as any).is_active !== false);
  }

  /** Get a specific agent by token ID. */
  async getAgent(tokenId: number): Promise<AgentInfo | null> {
    return await this.reader.readContractValue(
      this.registryAddress,
      "get_agent",
      [nativeToScVal(BigInt(tokenId), { type: "u64" })],
    );
  }

  /** Get all token IDs held by an owner. */
  async listTokensByOwner(owner: string, offset: number = 0, limit: number = 20): Promise<number[]> {
    const result = await this.reader.readContractValue(
      this.registryAddress,
      "list_tokens_by_owner",
      [
        nativeToScVal(owner, { type: "address" }),
        nativeToScVal(offset, { type: "u32" }),
        nativeToScVal(limit, { type: "u32" }),
      ],
    );
    return (result || []).map((id: any) => Number(id));
  }

  async getAgentByHandle(handle: string): Promise<AgentInfo | null> {
    return await this.reader.readContractValue(
      this.registryAddress,
      "get_agent_by_handle",
      [nativeToScVal(handle, { type: "string" })],
    );
  }

  async ownerOf(tokenId: number): Promise<string | null> {
    return await this.reader.readContractValue(
      this.registryAddress,
      "owner_of",
      [nativeToScVal(BigInt(tokenId), { type: "u64" })],
    );
  }

  async balanceOf(owner: string): Promise<number> {
    const balance = await this.reader.readContractValue(
      this.registryAddress,
      "balance_of",
      [nativeToScVal(owner, { type: "address" })],
    );
    return Number(balance || 0);
  }

  /** Get the total number of active agents. */
  async getActiveCount(): Promise<number> {
    const count = await this.reader.readContractValue(this.registryAddress, "active_count");
    return Number(count || 0);
  }

  async getTotalSupply(): Promise<number> {
    const count = await this.reader.readContractValue(this.registryAddress, "total_supply");
    return Number(count || 0);
  }
}
