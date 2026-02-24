import { buildX402Header as sdkBuildX402Header } from "@agenticocean/x402-stellar";
import { config } from "../config.js";
import { Keypair } from "@stellar/stellar-sdk";

export async function buildX402Header(params: {
  vaultContract: string;
  agentSigner: string;
  agentSecret: string;
  payTo: string;
  amount: string;
  memo: string;
  agentId: number;
}): Promise<string> {
  return sdkBuildX402Header({
    rpcUrl: config.STELLAR_RPC_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    usdcAddress: config.USDC_SAC_ADDRESS,
    facilitatorPublicKey: config.FACILITATOR_SECRET_KEY
      ? Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey()
      : undefined,
    ...params,
  });
}
