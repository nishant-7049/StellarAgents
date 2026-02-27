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
   *  Falls back to per-ID fetching when on-chain pagination is unavailable. */
  async listAgents(startTokenId: number = 1, limit: number = 10): Promise<AgentInfo[]> {
    if (limit <= 0) return [];
    const result = await this.reader.readContractValue(
      this.registryAddress,
      "list_agents",
      [nativeToScVal(BigInt(startTokenId), { type: "u64" }), nativeToScVal(limit, { type: "u32" })],
    );

    // Use on-chain list result when present and non-empty.
    // Some deployments return an empty list despite existing active tokens,
    // so we also keep a per-token fallback path.
    if (Array.isArray(result) && result.length > 0) return result;

    const nextId = await this.getNextTokenId();
    if (nextId <= 1) return [];

    const startIndex = startTokenId <= 1 ? 0 : startTokenId - 1;
    const needed = startIndex + limit;
    const lastTokenId = nextId - 1;
    const batchSize = 50;
    const active: AgentInfo[] = [];

    // Fallback scan: collect active agents in token-id order, then apply
    // the same 1-based active cursor semantics expected by list_agents.
    for (let from = 1; from <= lastTokenId && active.length < needed; from += batchSize) {
      const to = Math.min(lastTokenId, from + batchSize - 1);
      const fetches: Array<Promise<AgentInfo | null>> = [];
      for (let id = from; id <= to; id++) {
        fetches.push(this.getAgent(id));
      }

      const batch = await Promise.all(fetches);
      for (const agent of batch) {
        if (agent && (agent as any).is_active !== false) {
          active.push(agent);
        }
      }
    }

    return active.slice(startIndex, startIndex + limit);
  }

  /** List all minted agents (active + inactive) by token ID range. */
  async listAllAgents(startTokenId: number = 1, limit: number = 10): Promise<AgentInfo[]> {
    if (limit <= 0) return [];

    const nextId = await this.getNextTokenId();
    if (nextId <= 1) return [];

    const first = Math.max(1, startTokenId);
    const last = Math.min(nextId - 1, first + limit - 1);
    if (last < first) return [];

    const fetches: Array<Promise<AgentInfo | null>> = [];
    for (let id = first; id <= last; id++) {
      fetches.push(this.getAgent(id));
    }

    const agents = await Promise.all(fetches);
    return agents.filter((a): a is AgentInfo => a !== null);
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

  async exists(tokenId: number): Promise<boolean> {
    const exists = await this.reader.readContractValue(
      this.registryAddress,
      "exists",
      [nativeToScVal(BigInt(tokenId), { type: "u64" })],
    );
    return Boolean(exists);
  }

  async getName(): Promise<string> {
    const value = await this.reader.readContractValue(this.registryAddress, "name");
    return String(value || "");
  }

  async getSymbol(): Promise<string> {
    const value = await this.reader.readContractValue(this.registryAddress, "symbol");
    return String(value || "");
  }

  async getContractUri(): Promise<string> {
    const value = await this.reader.readContractValue(this.registryAddress, "contract_uri");
    return String(value || "");
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

  async getNextTokenId(): Promise<number> {
    const nextId = await this.reader.readContractValue(this.registryAddress, "next_token_id");
    return Number(nextId || 1);
  }
}
