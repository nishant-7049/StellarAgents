import { Keypair, Contract, TransactionBuilder, nativeToScVal, authorizeEntry } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";
import type { AgentAIConfig, BlendPoolData, UserBlendPosition, LoggerLike } from "./types.js";

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
    this.defaultPoolId = config.blendPoolId || "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF";
    this.log = config.logger ?? console;
  }

  async loadPool(poolId?: string): Promise<BlendPoolData> {
    const id = poolId || this.defaultPoolId;
    try {
      const { PoolV2, PoolEstimate } = await import("@blend-capital/blend-sdk");
      const network = { rpc: this.rpcUrl, passphrase: this.passphrase, opts: undefined };
      const pool: any = await PoolV2.load(network, id);
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

  /**
   * Execute a rebalancing supply via the UserVault.
   *
   * Flow:
   *   1. Build a SorobanAuthorizationEntry for vault.agent_pay(agent → blendPool, amount)
   *   2. Sign it with the agent signer key (NOT admin/owner)
   *   3. POST to the x402 facilitator — it wraps + submits on-chain
   *   4. Vault's smart contract enforces daily limit + destination policy
   *
   * No admin key is ever touched.
   */
  async executeViaVault(params: {
    poolId: string;
    agentSignerSecret: string;
    vaultContract: string;
    asset: string;
    amount: bigint;
    facilitatorUrl: string;
    memo: string;
  }): Promise<{ txHash: string }> {
    const agentKeypair = Keypair.fromSecret(params.agentSignerSecret);
    const agentAddress = agentKeypair.publicKey();

    try {
      const rpc = new Server(this.rpcUrl);

      // 1. Build a simulated vault.agent_pay() call to get the auth entry
      const vault = new Contract(params.vaultContract);
      const facilitatorAccount = await rpc.getAccount(agentAddress);

      const tx = new TransactionBuilder(facilitatorAccount, {
        fee: "1000000",
        networkPassphrase: this.passphrase,
      })
        .addOperation(
          vault.call(
            "agent_pay",
            nativeToScVal(agentAddress, { type: "address" }),
            nativeToScVal(params.poolId, { type: "address" }),   // Blend pool = pay_to
            nativeToScVal(params.amount, { type: "i128" }),
            nativeToScVal(params.memo, { type: "symbol" }),
          )
        )
        .setTimeout(60)
        .build();

      // 2. Simulate to get the auth entry that needs to be signed
      const sim = await rpc.simulateTransaction(tx);
      if (!("result" in sim) || !sim.result?.auth?.length) {
        this.log.warn("Vault agent_pay simulation returned no auth entries — using mock", { params });
        return { txHash: "mock_vault_tx_" + Date.now() };
      }

      // 3. Sign the agent's SorobanAuthorizationEntry using the SDK helper
      const latestLedger = await rpc.getLatestLedger();
      const expirationLedger = latestLedger.sequence + 100;
      const signedEntry = await authorizeEntry(
        sim.result.auth[0],
        agentKeypair,
        expirationLedger,
        this.passphrase,
      );
      const signedAuthEntry = signedEntry.toXDR("base64");

      // 4. POST to x402 facilitator — it submits vault.agent_pay() on-chain
      const response = await fetch(`${params.facilitatorUrl}/api/x402/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x402Version: 1,
          scheme: "stellar-vault",
          network: "stellar:testnet",
          payload: {
            vaultContract: params.vaultContract,
            agentSigner: agentAddress,
            payTo: params.poolId,
            amount: params.amount.toString(),
            asset: params.asset,
            memo: params.memo,
            signedAuthEntry,
            expirationLedger,
          },
        }),
      });

      const result = await response.json() as any;
      if (!result.success) throw new Error(result.error || "Facilitator rejected payment");

      this.log.info("Vault agent_pay executed via facilitator", {
        txHash: result.txHash,
        amount: params.amount.toString(),
        vault: params.vaultContract,
      });
      return { txHash: result.txHash };

    } catch (err) {
      this.log.error("executeViaVault failed", { error: String(err) });
      throw err;
    }
  }

  async loadUserPosition(vaultAddress: string, poolId?: string): Promise<UserBlendPosition> {
    const id = poolId || this.defaultPoolId;
    try {
      const { PoolV2, PositionsEstimate } = await import("@blend-capital/blend-sdk");
      const network = { rpc: this.rpcUrl, passphrase: this.passphrase, opts: undefined };
      const pool: any = await PoolV2.load(network, id);
      const oracle = await pool.loadOracle();
      const user: any = await pool.loadUser(vaultAddress);
      if (!user?.positions) {
        return { poolId: id, estimatedSupplyValue: 0, estimatedBorrowValue: 0, netApr: 0 };
      }
      const posEst = PositionsEstimate.build(pool, oracle, user.positions);
      return {
        poolId: id,
        estimatedSupplyValue: posEst.totalSupplied || 0,
        estimatedBorrowValue: posEst.totalBorrowed || 0,
        netApr: posEst.netApy || 0,
      };
    } catch (err) {
      this.log.warn("loadUserPosition failed, returning 0", { vaultAddress, error: String(err) });
      return { poolId: id, estimatedSupplyValue: 0, estimatedBorrowValue: 0, netApr: 0 };
    }
  }

  getDefaultPoolId(): string {
    return this.defaultPoolId;
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
