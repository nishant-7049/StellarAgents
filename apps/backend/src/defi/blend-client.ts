import { config } from "../config.js";
import { logger } from "../logger.js";

export interface BlendPoolData {
  poolId: string;
  poolName: string;
  reserves: Array<{
    assetId: string;
    symbol: string;
    supplyApy: number;
    borrowApy: number;
    totalSupply: string;
    totalBorrow: string;
    utilization: number;
  }>;
  emissions: { blndPerDay: number; estimatedBlndApy: number };
}

export interface UserBlendPosition {
  poolId: string;
  estimatedSupplyValue: number;
  estimatedBorrowValue: number;
  netApr: number;
}

export class BlendClient {
  async loadPool(poolId?: string): Promise<BlendPoolData> {
    const id = poolId || config.BLEND_POOL_USDC || "CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB";
    try {
      // Attempt to load from Blend SDK
      const { Pool, PoolEstimate } = await import("@blend-capital/blend-sdk");
      const network = { rpc: config.STELLAR_RPC_URL, passphrase: config.STELLAR_NETWORK_PASSPHRASE, opts: undefined };
      const pool = await Pool.load(network, id);
      const oracle = await pool.loadOracle();
      const estimate = PoolEstimate.build(pool.reserves, oracle);
      const reserves = [];
      for (const [index, reserve] of pool.reserves.entries()) {
        const reserveEst = estimate.reserves.get(index);
        reserves.push({
          assetId: reserve.assetId,
          symbol: reserve.tokenMetadata?.symbol || `reserve_${index}`,
          supplyApy: reserveEst ? reserveEst.supplyApr * 100 : 0,
          borrowApy: reserveEst ? reserveEst.borrowApr * 100 : 0,
          totalSupply: reserve.totalSupplyUnderlying().toString(),
          totalBorrow: reserve.totalBorrowsUnderlying().toString(),
          utilization: reserveEst?.utilization || 0,
        });
      }
      return { poolId: id, poolName: pool.config.name || "Blend Pool", reserves, emissions: { blndPerDay: 0, estimatedBlndApy: 0 } };
    } catch (err) {
      logger.warn("Blend SDK load failed, using mock data", { error: String(err) });
      return this.getMockPoolData(id);
    }
  }

  buildSupplyOp(params: { poolId: string; from: string; asset: string; amount: bigint }): string {
    logger.info("Building Blend supply op", params);
    // Mock: return a placeholder XDR string representing the supply operation
    return `mock_supply_op_${params.poolId}_${params.amount}`;
  }

  buildWithdrawOp(params: { poolId: string; from: string; asset: string; amount: bigint }): string {
    logger.info("Building Blend withdraw op", params);
    // Mock: return a placeholder XDR string representing the withdraw operation
    return `mock_withdraw_op_${params.poolId}_${params.amount}`;
  }

  async executeSupply(params: { poolId: string; signerSecret: string; asset: string; amount: bigint }): Promise<{ txHash: string }> {
    logger.info("Blend supply (mock)", { poolId: params.poolId, amount: params.amount.toString() });
    return { txHash: "mock_blend_tx_" + Date.now() };
  }

  private getMockPoolData(poolId: string): BlendPoolData {
    return {
      poolId,
      poolName: "Blend YieldBox v2 (Mock)",
      reserves: [
        { assetId: config.USDC_SAC_ADDRESS || "CUSDC", symbol: "USDC", supplyApy: 7.2, borrowApy: 9.8, totalSupply: "45000000000000", totalBorrow: "30000000000000", utilization: 0.67 },
        { assetId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", symbol: "XLM", supplyApy: 4.1, borrowApy: 6.5, totalSupply: "200000000000000", totalBorrow: "80000000000000", utilization: 0.40 },
      ],
      emissions: { blndPerDay: 50000, estimatedBlndApy: 2.3 },
    };
  }
}

export const blendClient = new BlendClient();
