import type { AgentAIConfig, SwapQuote, PoolData, LoggerLike } from "./types.js";

/**
 * Soroswap DEX client.
 *
 * Provides swap quotes, pool liquidity data, and swap execution for rebalancing.
 */
export class SoroswapClient {
  private sdk: any = null;
  private usdcAddress: string;
  private rpcUrl: string;
  private passphrase: string;
  private log: LoggerLike;

  constructor(config: AgentAIConfig) {
    this.usdcAddress = config.usdcAddress || "CUSDC";
    this.rpcUrl = config.stellarRpcUrl;
    this.passphrase = config.networkPassphrase;
    this.log = config.logger ?? console;
    if (config.soroswapApiKey) {
      this.initSdk(config.soroswapApiKey);
    }
  }

  private async initSdk(apiKey: string) {
    try {
      const { SoroswapSDK, SupportedNetworks } = await import("@soroswap/sdk" as any);
      this.sdk = new SoroswapSDK({
        apiKey,
        defaultNetwork: SupportedNetworks.TESTNET,
      });
      this.log.info("Soroswap SDK initialized");
    } catch (err) {
      this.log.warn("Soroswap SDK init failed, using mock", { error: String(err) });
    }
  }

  async getQuote(params: { assetIn: string; assetOut: string; amount: bigint }): Promise<SwapQuote> {
    if (this.sdk) {
      try {
        const { SupportedNetworks, SupportedProtocols, TradeType } = await import("@soroswap/sdk" as any);
        const quote = await this.sdk.quote({
          assetIn: params.assetIn,
          assetOut: params.assetOut,
          amount: params.amount,
          tradeType: TradeType.EXACT_IN,
          protocols: [SupportedProtocols.SOROSWAP],
          slippageBps: "100",
          network: SupportedNetworks.TESTNET,
        });
        return {
          amountIn: quote.amountIn?.toString() || "0",
          amountOut: quote.amountOut?.toString() || "0",
          priceImpact: quote.priceImpact || 0,
          route: quote.path || [],
          protocol: "soroswap",
        };
      } catch (err) {
        this.log.error("Soroswap quote failed", { error: String(err) });
      }
    }
    return this.getMockQuote(params);
  }

  async buildSwap(params: { assetIn: string; assetOut: string; amount: bigint; from: string }): Promise<string | null> {
    if (!this.sdk) return null;
    try {
      const { SupportedNetworks, SupportedProtocols, TradeType } = await import("@soroswap/sdk" as any);
      const quote = await this.sdk.quote({
        assetIn: params.assetIn,
        assetOut: params.assetOut,
        amount: params.amount,
        tradeType: TradeType.EXACT_IN,
        protocols: [SupportedProtocols.SOROSWAP],
        slippageBps: "100",
        network: SupportedNetworks.TESTNET,
      });
      const buildResult = await this.sdk.build({ quote, from: params.from });
      return buildResult?.xdr || null;
    } catch (err) {
      this.log.error("Soroswap build failed", { error: String(err) });
      return null;
    }
  }

  async loadLPPosition(vaultAddress: string, pairAddress?: string): Promise<{ pairAddress: string; valueUSDC: number }> {
    const pair = pairAddress || "SOROSWAP_USDC_XLM_PAIR";
    try {
      const { Contract, TransactionBuilder, nativeToScVal, scValToNative } = await import("@stellar/stellar-sdk");
      const { Server: RpcServer } = await import("@stellar/stellar-sdk/rpc");
      const rpc = new RpcServer(this.rpcUrl);

      const pairContract = new Contract(pair);
      const sourceAccount = await rpc.getAccount(vaultAddress).catch(() => null);
      if (!sourceAccount) return { pairAddress: pair, valueUSDC: 0 };

      const balanceTx = new TransactionBuilder(sourceAccount, { fee: "100", networkPassphrase: this.passphrase })
        .addOperation(pairContract.call("balance", nativeToScVal(vaultAddress, { type: "address" })))
        .setTimeout(10).build();
      const balanceSim = await rpc.simulateTransaction(balanceTx);
      if (!("result" in balanceSim) || !balanceSim.result?.retval) return { pairAddress: pair, valueUSDC: 0 };
      const lpBalance = scValToNative(balanceSim.result.retval) as bigint;

      const supplyTx = new TransactionBuilder(sourceAccount, { fee: "100", networkPassphrase: this.passphrase })
        .addOperation(pairContract.call("total_supply"))
        .setTimeout(10).build();
      const supplySim = await rpc.simulateTransaction(supplyTx);
      if (!("result" in supplySim) || !supplySim.result?.retval) return { pairAddress: pair, valueUSDC: 0 };
      const totalSupply = scValToNative(supplySim.result.retval) as bigint;
      if (totalSupply === 0n) return { pairAddress: pair, valueUSDC: 0 };

      const reservesTx = new TransactionBuilder(sourceAccount, { fee: "100", networkPassphrase: this.passphrase })
        .addOperation(pairContract.call("get_reserves"))
        .setTimeout(10).build();
      const reservesSim = await rpc.simulateTransaction(reservesTx);
      if (!("result" in reservesSim) || !reservesSim.result?.retval) return { pairAddress: pair, valueUSDC: 0 };
      const [reserve0] = scValToNative(reservesSim.result.retval) as [bigint, bigint];

      // vault's USDC share = (lpBalance / totalSupply) * reserve0 (if token0 = USDC)
      const usdcValue = Number((lpBalance * reserve0) / totalSupply) / 1e7;
      return { pairAddress: pair, valueUSDC: usdcValue };
    } catch (err) {
      this.log.warn("loadLPPosition failed, returning 0", { pair, error: String(err) });
      return { pairAddress: pair, valueUSDC: 0 };
    }
  }

  async getPools(): Promise<PoolData[]> {
    return [
      {
        pairAddress: "SOROSWAP_USDC_XLM_PAIR",
        token0: this.usdcAddress,
        token1: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
        reserve0: "4800000000000",
        reserve1: "120000000000000",
        apy: 12.5,
      },
    ];
  }

  private getMockQuote(params: { amount: bigint; assetIn: string; assetOut: string }): SwapQuote {
    const rate = 4n;
    return {
      amountIn: params.amount.toString(),
      amountOut: (params.amount * rate).toString(),
      priceImpact: 0.02,
      route: [params.assetIn, params.assetOut],
      protocol: "soroswap-mock",
    };
  }
}
