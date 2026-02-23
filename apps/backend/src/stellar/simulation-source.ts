import { Keypair } from "@stellar/stellar-sdk";
import { config } from "../config.js";

function publicFromSecret(secret: string | undefined): string | undefined {
  if (!secret) return undefined;
  try {
    return Keypair.fromSecret(secret).publicKey();
  } catch {
    return undefined;
  }
}

/**
 * Resolve a public simulation source account for read-only Soroban calls.
 * Prefer explicit public key env, then derive from any configured secret key.
 */
export function getSimulationSourcePublicKey(): string | undefined {
  const explicit = config.STELLAR_SIMULATION_SOURCE.trim();
  if (explicit.length > 0) return explicit;

  return (
    publicFromSecret(config.FACILITATOR_SECRET_KEY) ||
    publicFromSecret(config.ADMIN_SECRET_KEY) ||
    publicFromSecret(config.AGENT_SIGNER_SECRET_KEY) ||
    undefined
  );
}

