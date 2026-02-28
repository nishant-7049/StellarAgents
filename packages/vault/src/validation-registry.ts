import { nativeToScVal } from "@stellar/stellar-sdk";
import { ContractReader } from "./contract-reader.js";
import type { StellarClientConfig, Validation, LoggerLike } from "./types.js";

/**
 * Read-only client for the ValidationRegistry contract.
 */
export class ValidationRegistry {
  private reader: ContractReader;
  private validationAddress: string;

  constructor(validationAddress: string, config: StellarClientConfig, logger?: LoggerLike) {
    this.validationAddress = validationAddress;
    this.reader = new ContractReader(config, logger);
  }

  /** Get all validations for an agent. */
  async getValidations(agentId: number): Promise<Validation[]> {
    const result = await this.reader.readContractValue(
      this.validationAddress,
      "get_validations",
      [nativeToScVal(agentId, { type: "u32" })],
    );
    return result || [];
  }
}
