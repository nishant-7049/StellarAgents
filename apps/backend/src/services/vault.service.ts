import { config } from "../config.js";
import { readContractValue, getVaultBalance } from "../stellar/contract-reader.js";
import { nativeToScVal } from "@stellar/stellar-sdk";

export class VaultService {
  async getVaultForOwner(owner: string): Promise<string | null> {
    if (!config.VAULT_FACTORY_ADDRESS) return null;
    try {
      return await readContractValue(
        config.VAULT_FACTORY_ADDRESS,
        "get_vault",
        [nativeToScVal(owner, { type: "address" })]
      );
    } catch {
      return null;
    }
  }

  async getBalance(vaultAddress: string): Promise<string> {
    return getVaultBalance(vaultAddress);
  }
}

export const vaultService = new VaultService();
