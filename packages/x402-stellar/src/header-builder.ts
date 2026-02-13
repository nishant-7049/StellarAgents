import {
  Keypair, TransactionBuilder, Contract, nativeToScVal, authorizeEntry,
} from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";

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
 */
export async function buildX402Header(params: {
  rpcUrl: string;
  networkPassphrase: string;
  vaultContract: string;
  agentSigner: string;
  agentSecret: string;
  payTo: string;
  amount: string;
  memo: string;
  agentId: number;
  usdcAddress: string;
  facilitatorPublicKey?: string;
}): Promise<string> {
  const rpc = new Server(params.rpcUrl);
  const agentKp = Keypair.fromSecret(params.agentSecret);
  const vault = new Contract(params.vaultContract);

  const sourcePub = params.facilitatorPublicKey || agentKp.publicKey();

  const account = await rpc.getAccount(sourcePub);
  const tx = new TransactionBuilder(account, {
    fee: "1000000",
    networkPassphrase: params.networkPassphrase,
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

  const latestLedger = sim.latestLedger;
  const validUntilLedger = latestLedger + 1000;

  const signedAuth = await authorizeEntry(
    authEntries[0],
    agentKp,
    validUntilLedger,
    params.networkPassphrase,
  );

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
      asset: params.usdcAddress,
      memo: params.memo,
      signedAuthEntry: signedAuth.toXDR("base64"),
      assembledTxXdr: assembled.toXDR(),
      expirationLedger: validUntilLedger,
    },
  };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}
