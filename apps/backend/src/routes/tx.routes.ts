import { Router } from "express";
import { invokeContract } from "../stellar/tx-builder.js";
import { Contract, nativeToScVal, TransactionBuilder, Networks, xdr } from "@stellar/stellar-sdk";
import { Server, assembleTransaction } from "@stellar/stellar-sdk/rpc";
import { config } from "../config.js";

const rpc = new Server(config.STELLAR_RPC_URL);

export const txRoutes = Router();

/**
 * POST /api/tx/build
 * Build a contract transaction and return XDR for frontend signing
 */
txRoutes.post("/build", async (req, res) => {
  try {
    const { contractId, method, args, publicKey } = req.body;

    if (!contractId || !method || !publicKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build transaction
    const contract = new Contract(contractId);
    const account = await rpc.getAccount(publicKey);

    // Decode XDR args from base64
    const scArgs = args.map((arg: string) => xdr.ScVal.fromXDR(arg, "base64"));

    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call(method, ...scArgs))
      .setTimeout(60)
      .build();

    // Simulate
    const sim = await rpc.simulateTransaction(tx);
    if (!("result" in sim)) {
      return res.status(400).json({ error: "Simulation failed" });
    }

    // Assemble with simulation results
    const assembled = assembleTransaction(tx, sim).build();

    // Return XDR
    res.json({ xdr: assembled.toXDR() });
  } catch (err: any) {
    console.error("Build tx failed:", err);
    res.status(500).json({ error: err.message });
  }
});
