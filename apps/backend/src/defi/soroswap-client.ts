import { config } from "../config.js";
import { logger } from "../logger.js";

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  route: string[];
  protocol: string;
}

export interface PoolData {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  apy: number;
}

export class SoroswapClient {
  async getQuote(params: { assetIn: string; assetOut: string; amount: bigint }): Promise<SwapQuote> {
    logger.debug("Soroswap quote request", params);
    return this.getMockQuote(params);
  }

  async buildSwap(params: { assetIn: string; assetOut: string; amount: bigint; from: string }): Promise<string | null> {
    logger.debug("Soroswap build swap", params);
    return null;
  }

  async getPools(): Promise<PoolData[]> {
    return [
      {
        pairAddress: "SOROSWAP_USDC_XLM_PAIR",
        token0: config.USDC_SAC_ADDRESS || "CUSDC",
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

export const soroswapClient = new SoroswapClient();
