// ── Stellar Network Configuration ──

export interface StellarNetworkConfig {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl?: string;
  explorerUrl?: string;
}

export const TESTNET: StellarNetworkConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  friendbotUrl: "https://friendbot.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/testnet",
};

export const MAINNET: StellarNetworkConfig = {
  rpcUrl: "https://soroban.stellar.org",
  horizonUrl: "https://horizon.stellar.org",
  networkPassphrase: "Public Global Stellar Network ; September 2015",
  explorerUrl: "https://stellar.expert/explorer/public",
};

export const STELLAR_CONFIG = {
  testnet: {
    rpcUrl: TESTNET.rpcUrl,
    horizonUrl: TESTNET.horizonUrl,
    networkPassphrase: TESTNET.networkPassphrase,
    friendbotUrl: TESTNET.friendbotUrl!,
    explorerUrl: TESTNET.explorerUrl!,
  },
  mainnet: {
    rpcUrl: MAINNET.rpcUrl,
    horizonUrl: MAINNET.horizonUrl,
    networkPassphrase: MAINNET.networkPassphrase,
    friendbotUrl: "",
    explorerUrl: MAINNET.explorerUrl!,
  },
} as const;

export type StellarNetwork = keyof typeof STELLAR_CONFIG;

// ── USDC Constants ──

export const USDC_DECIMALS = 7;
export const STROOPS_PER_USDC = 10_000_000;

// ── Utility Functions ──

export function formatUsdc(stroops: string | number | bigint): string {
  const amount = typeof stroops === "bigint"
    ? Number(stroops)
    : typeof stroops === "string"
      ? parseInt(stroops)
      : stroops;
  return (amount / STROOPS_PER_USDC).toFixed(2);
}

export function toStroops(usdc: number): bigint {
  return BigInt(Math.round(usdc * STROOPS_PER_USDC));
}
