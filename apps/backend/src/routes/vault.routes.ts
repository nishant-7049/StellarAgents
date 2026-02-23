import { Router } from "express";
import { config } from "../config.js";

export const vaultRoutes = Router();

vaultRoutes.get("/:owner", async (req, res) => {
  const { owner } = req.params;
  res.json({
    owner,
    factory: config.VAULT_FACTORY_ADDRESS,
    message: "Use Freighter to interact with vault contracts directly",
  });
});

vaultRoutes.get("/:owner/balance", async (req, res) => {
  res.json({ balance: "0", currency: "USDC", decimals: 7 });
});
