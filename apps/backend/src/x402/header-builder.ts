import { Keypair, Networks, TransactionBuilder, Contract, nativeToScVal, authorizeEntry } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";

/**
 * Build an X-PAYMENT header for x402 protocol.
 *
 * This is the agent-side function. It:
 * 1. Simulates vault.agent_pay() to get the required SorobanAuthorizationEntry
 * 2. Signs the auth entry with the agent's private key (authorizeEntry)
 * 3. Assembles the full transaction (to capture the correct footprint + resources)
 * 4. Packages the signed auth entry AND assembled transaction XDR
 *
 * CRITICAL: The assembled transaction XDR is included because it contains the
 * footprint with the correct auth nonce. If the facilitator re-simulates, it
 * gets a DIFFERENT nonce, causing an INVOKE_HOST_FUNCTION_TRAPPED error.
 *
 * The facilitator will:
 * - Receive the pre-assembled transaction
 * - Sign it as source account (pays XLM fees)
 * - Submit to the network
 */
export async function buildX402Header(params: {
  vaultContract: string;
  agentSigner: string;
  agentSecret: string;
  payTo: string;
  amount: string;
  memo: string;
  agentId: number;
}): Promise<string> {
  const rpc = new Server(config.STELLAR_RPC_URL);
  const agentKp = Keypair.fromSecret(params.agentSecret);
  const vault = new Contract(params.vaultContract);

  // Use facilitator as source account since they'll submit the final tx.
  const facilitatorPub = config.FACILITATOR_SECRET_KEY
    ? Keypair.fromSecret(config.FACILITATOR_SECRET_KEY).publicKey()
    : agentKp.publicKey();

  const account = await rpc.getAccount(facilitatorPub);
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      vault.call(
        "agent_pay",
        nativeToScVal(params.agentSigner, { type: "address" }),
        nativeToScVal(params.payTo, { type: "address" }),
        nativeToScVal(BigInt(params.amount), { type: "i128" }),
        nativeToScVal(params.memo, { type: "symbol" }),
      )
    )
    .setTimeout(60)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (!("result" in sim)) throw new Error("Simulation failed for x402 header");

  const authEntries = sim.result?.auth || [];
  if (authEntries.length === 0) throw new Error("No auth entries from simulation");

  // Sign the auth entry with the agent's keypair.
  const latestLedger = sim.latestLedger;
  const validUntilLedger = latestLedger + 1000;

  const signedAuth = await authorizeEntry(
    authEntries[0],
    agentKp,
    validUntilLedger,
    Networks.TESTNET,
  );

  // Replace the unsigned auth with the signed one in the simulation result,
  // then assemble. This ensures the footprint matches the signed auth's nonce.
  sim.result!.auth = [signedAuth];
  const assembled = assembleTransaction(tx, sim).build();

  const payload = {
    x402Version: 1,
    scheme: "stellar-vault",
    network: "stellar:testnet",
    payload: {
      vaultContract: params.vaultContract,
      agentId: params.agentId,
      agentSigner: params.agentSigner,
      payTo: params.payTo,
      amount: params.amount,
      asset: config.USDC_SAC_ADDRESS,
      memo: params.memo,
      signedAuthEntry: signedAuth.toXDR("base64"),
      // Include the fully assembled transaction XDR.
      // The facilitator signs this directly instead of re-simulating.
      assembledTxXdr: assembled.toXDR("base64"),
      expirationLedger: validUntilLedger,
    },
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
