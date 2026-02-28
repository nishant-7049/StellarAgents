import { Contract, scValToNative, TransactionBuilder } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import type { StellarClientConfig, LoggerLike } from "./types.js";

const DEFAULT_SOURCE = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/**
 * Low-level contract reader that simulates read-only contract calls.
 */
export class ContractReader {
  private rpc: Server;
  private simulationSource: string;
  private passphrase: string;
  private log: LoggerLike;

  constructor(config: StellarClientConfig, logger?: LoggerLike) {
    this.rpc = new Server(config.rpcUrl);
    this.passphrase = config.networkPassphrase;
    this.simulationSource = config.simulationSourceKey || DEFAULT_SOURCE;
    this.log = logger ?? console;
  }

  /**
   * Simulate a read-only contract call and return the decoded result.
   */
  async readContractValue(contractId: string, method: string, args: any[] = []): Promise<any> {
    try {
      const contract = new Contract(contractId);
      const account = await this.rpc.getAccount(this.simulationSource);
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: this.passphrase,
      })
        .addOperation(contract.call(method, ...args))
        .setTimeout(30)
        .build();

      const result = await this.rpc.simulateTransaction(tx);
      if ("result" in result && result.result?.retval) {
        const native = scValToNative(result.result.retval);
        return this.convertBigInts(native);
      }
      return null;
    } catch (err) {
      this.log.error("Contract read failed", { contractId, method, error: err });
      return null;
    }
  }

  /**
   * Recursively convert BigInt values to numbers for JSON serialization.
   */
  private convertBigInts(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "bigint") return Number(obj);
    if (Array.isArray(obj)) return obj.map((item) => this.convertBigInts(item));
    if (typeof obj === "object") {
      const converted: any = {};
      for (const key in obj) {
        converted[key] = this.convertBigInts(obj[key]);
      }
      return converted;
    }
    return obj;
  }
}
