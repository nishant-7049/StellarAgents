import { nativeToScVal } from "@stellar/stellar-sdk";
import { ContractReader } from "./contract-reader.js";
import type { StellarClientConfig, AgentPolicy, LoggerLike } from "./types.js";

/**
 * Read-only client for a UserVault contract instance.
 */
export class UserVault {
  private reader: ContractReader;
  private vaultAddress: string;

  constructor(vaultAddress: string, config: StellarClientConfig, logger?: LoggerLike) {
    this.vaultAddress = vaultAddress;
    this.reader = new ContractReader(config, logger);
  }

  /** Get the USDC balance of this vault (in stroops). */
  async getBalance(): Promise<string> {
    const balance = await this.reader.readContractValue(this.vaultAddress, "balance");
    return balance?.toString() || "0";
  }

  /** Get the lifetime total USDC spent through agent_pay (in stroops). */
  async getTotalSpent(): Promise<string> {
    const total = await this.reader.readContractValue(this.vaultAddress, "total_spent");
    return total?.toString() || "0";
  }

  /** Get the spending policy for a specific agent. */
  async getAgentPolicy(agentAddress: string): Promise<AgentPolicy | null> {
    return await this.reader.readContractValue(
      this.vaultAddress,
      "get_agent_policy",
      [nativeToScVal(agentAddress, { type: "address" })],
    );
  }

  /** Get the remaining daily spending limit for an agent (in stroops). */
  async getRemainingLimit(agentAddress: string): Promise<string> {
    const result = await this.reader.readContractValue(
      this.vaultAddress,
      "remaining_limit",
      [nativeToScVal(agentAddress, { type: "address" })],
    );
    return result?.toString() || "0";
  }
}
