import type { AgentAIConfig, SwapQuote, PoolData, LoggerLike } from "./types.js";

/**
 * Soroswap DEX client.
 *
 * Provides swap quotes, pool liquidity data, and swap execution for rebalancing.
 */
export class SoroswapClient {
  private sdk: any = null;
  private usdcAddress: string;
  private log: LoggerLike;

  constructor(config: AgentAIConfig) {
    this.usdcAddress = config.usdcAddress || "CUSDC";
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
