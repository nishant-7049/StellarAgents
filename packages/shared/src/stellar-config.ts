export const STELLAR_CONFIG = {
  testnet: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    friendbotUrl: "https://friendbot.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
} as const;

export type StellarNetwork = keyof typeof STELLAR_CONFIG;

export const USDC_DECIMALS = 7;
export const STROOPS_PER_USDC = 10_000_000;
