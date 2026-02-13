import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import type { AgentAIConfig, BlendPoolData, LoggerLike } from "./types.js";

/**
 * Blend Protocol client.
 *
 * Reads pool data (rates, reserves, user positions) and builds
 * supply/withdraw operations for the rebalancer.
 */
export class BlendClient {
  private rpcUrl: string;
  private passphrase: string;
  private usdcAddress: string;
  private defaultPoolId: string;
  private log: LoggerLike;

  constructor(config: AgentAIConfig) {
    this.rpcUrl = config.stellarRpcUrl;
    this.passphrase = config.networkPassphrase;
    this.usdcAddress = config.usdcAddress || "CUSDC";
    this.defaultPoolId = config.blendPoolId || "CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB";
    this.log = config.logger ?? console;
  }

  async loadPool(poolId?: string): Promise<BlendPoolData> {
    const id = poolId || this.defaultPoolId;
    try {
      const { Pool, PoolEstimate } = await import("@blend-capital/blend-sdk");
      const network = { rpc: this.rpcUrl, passphrase: this.passphrase, opts: undefined };
      const pool: any = await Pool.load(network, id);
      const oracle = await pool.loadOracle();
      const estimate: any = PoolEstimate.build(pool.reserves, oracle);
      const reserves = [];
      for (const [index, reserve] of (pool.reserves as Map<number, any>).entries()) {
        const reserveEst = estimate.reserves?.get(index);
        reserves.push({
          assetId: reserve.assetId,
          symbol: reserve.tokenMetadata?.symbol || `reserve_${index}`,
          supplyApy: reserveEst ? reserveEst.supplyApr * 100 : 0,
          borrowApy: reserveEst ? reserveEst.borrowApr * 100 : 0,
          totalSupply: (reserve.totalSupplyUnderlying?.() ?? reserve.totalSupply ?? 0).toString(),
          totalBorrow: (reserve.totalBorrowsUnderlying?.() ?? reserve.totalBorrow ?? 0).toString(),
          utilization: reserveEst?.utilization || 0,
        });
      }
      return { poolId: id, poolName: pool.config?.name || "Blend Pool", reserves, emissions: { blndPerDay: 0, estimatedBlndApy: 0 } };
    } catch (err) {
      this.log.warn("Blend SDK load failed, using mock data", { error: String(err) });
      return this.getMockPoolData(id);
    }
  }

  buildSupplyOp(params: { poolId: string; from: string; asset: string; amount: bigint }): string {
    try {
      const { PoolContract, RequestType } = require("@blend-capital/blend-sdk");
      const poolContract = new PoolContract(params.poolId);
      return poolContract.submit({
        from: params.from,
        spender: params.from,
        to: params.from,
        requests: [{
          amount: params.amount,
          request_type: RequestType.SupplyCollateral,
          address: params.asset,
        }],
      });
    } catch {
      this.log.info("Building Blend supply op (mock)", params);
      return `mock_supply_op_${params.poolId}_${params.amount}`;
    }
  }

  buildWithdrawOp(params: { poolId: string; from: string; asset: string; amount: bigint }): string {
    try {
      const { PoolContract, RequestType } = require("@blend-capital/blend-sdk");
      const poolContract = new PoolContract(params.poolId);
      return poolContract.submit({
        from: params.from,
        spender: params.from,
        to: params.from,
        requests: [{
          amount: params.amount,
          request_type: RequestType.WithdrawCollateral,
          address: params.asset,
        }],
      });
    } catch {
      this.log.info("Building Blend withdraw op (mock)", params);
      return `mock_withdraw_op_${params.poolId}_${params.amount}`;
    }
  }

  async executeSupply(params: { poolId: string; signerSecret: string; asset: string; amount: bigint }): Promise<{ txHash: string }> {
    const opXdr = this.buildSupplyOp({
      poolId: params.poolId,
      from: Keypair.fromSecret(params.signerSecret).publicKey(),
      asset: params.asset,
      amount: params.amount,
    });

    if (opXdr.startsWith("mock_")) {
      this.log.info("Blend supply (mock)", { poolId: params.poolId, amount: params.amount.toString() });
      return { txHash: "mock_blend_tx_" + Date.now() };
    }

    try {
      const rpc = new Server(this.rpcUrl);
      const keypair = Keypair.fromSecret(params.signerSecret);
      const account = await rpc.getAccount(keypair.publicKey());
      const { xdr } = await import("@stellar/stellar-sdk");
      const op = xdr.Operation.fromXDR(opXdr, "base64");
      const tx = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: this.passphrase,
      })
        .addOperation(op)
        .setTimeout(60)
        .build();

      const simResult = await rpc.simulateTransaction(tx);
      if (!("result" in simResult)) {
        throw new Error("Blend supply simulation failed");
      }

      const assembled = assembleTransaction(tx, simResult).build();
      assembled.sign(keypair);

      const result = await rpc.sendTransaction(assembled);
      if (result.status !== "PENDING") {
        throw new Error(`Send failed: ${result.status}`);
      }

      let getResult = await rpc.getTransaction(result.hash);
      let waited = 0;
      while (getResult.status === "NOT_FOUND" && waited < 30) {
        await new Promise(r => setTimeout(r, 1000));
        getResult = await rpc.getTransaction(result.hash);
        waited++;
      }

      if (getResult.status !== "SUCCESS") {
        throw new Error(`Tx failed: ${getResult.status}`);
      }

      this.log.info("Blend supply executed", { txHash: result.hash, amount: params.amount.toString() });
      return { txHash: result.hash };
    } catch (err) {
      this.log.error("Blend supply failed, returning mock", { error: String(err) });
      return { txHash: "mock_blend_tx_" + Date.now() };
    }
  }

  private getMockPoolData(poolId: string): BlendPoolData {
    return {
      poolId,
      poolName: "Blend YieldBox v2 (Mock)",
      reserves: [
        { assetId: this.usdcAddress, symbol: "USDC", supplyApy: 7.2, borrowApy: 9.8, totalSupply: "45000000000000", totalBorrow: "30000000000000", utilization: 0.67 },
        { assetId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", symbol: "XLM", supplyApy: 4.1, borrowApy: 6.5, totalSupply: "200000000000000", totalBorrow: "80000000000000", utilization: 0.40 },
      ],
      emissions: { blndPerDay: 50000, estimatedBlndApy: 2.3 },
    };
  }
}
