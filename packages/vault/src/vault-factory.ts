import { nativeToScVal } from "@stellar/stellar-sdk";
import { ContractReader } from "./contract-reader.js";
import type { StellarClientConfig, LoggerLike } from "./types.js";

/**
 * Read-only client for the VaultFactory contract.
 */
export class VaultFactory {
  private reader: ContractReader;
  private factoryAddress: string;

  constructor(factoryAddress: string, config: StellarClientConfig, logger?: LoggerLike) {
    this.factoryAddress = factoryAddress;
    this.reader = new ContractReader(config, logger);
  }

  /** Get the vault address for a given owner, or null if none exists. */
  async getVault(owner: string): Promise<string | null> {
    return await this.reader.readContractValue(
      this.factoryAddress,
      "get_vault",
      [nativeToScVal(owner, { type: "address" })],
    );
  }

  /** Check whether an owner has a vault. */
  async hasVault(owner: string): Promise<boolean> {
    const vault = await this.getVault(owner);
    return vault !== null;
  }

  /** Get the total number of vaults created. */
  async vaultCount(): Promise<number> {
    const count = await this.reader.readContractValue(this.factoryAddress, "vault_count");
    return count || 0;
  }
}
