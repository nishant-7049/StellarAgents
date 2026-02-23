// ── Stellar Network Configuration ──

export interface StellarNetworkConfig {
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl?: string;
  explorerUrl?: string;
}

function fromEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

const RUNTIME_NETWORK_PASSPHRASE = fromEnv([
  "STELLAR_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE",
]);
const TESTNET_NETWORK_PASSPHRASE = fromEnv([
  "STELLAR_TESTNET_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_STELLAR_TESTNET_NETWORK_PASSPHRASE",
]) || RUNTIME_NETWORK_PASSPHRASE;
const MAINNET_NETWORK_PASSPHRASE = fromEnv([
  "STELLAR_MAINNET_NETWORK_PASSPHRASE",
  "NEXT_PUBLIC_STELLAR_MAINNET_NETWORK_PASSPHRASE",
]) || RUNTIME_NETWORK_PASSPHRASE;

export const TESTNET: StellarNetworkConfig = {
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  networkPassphrase: TESTNET_NETWORK_PASSPHRASE,
  friendbotUrl: "https://friendbot.stellar.org",
  explorerUrl: "https://stellar.expert/explorer/testnet",
};

export const MAINNET: StellarNetworkConfig = {
  rpcUrl: "https://soroban.stellar.org",
  horizonUrl: "https://mainnet.stellar.validationcloud.io/v1/9yVi48mHuKmpZ93vHAN53l7esd_r4ftsnlFS_LCz6-8",
  networkPassphrase: MAINNET_NETWORK_PASSPHRASE,
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
