import { Router } from "express";
import { vaultService } from "../services/vault.service.js";
import { logger } from "../logger.js";

export const vaultRoutes = Router();

vaultRoutes.get("/:owner", async (req, res) => {
  const { owner } = req.params;
  try {
    const vaultAddress = await vaultService.getVaultForOwner(owner);
    if (!vaultAddress) {
      return res.json({ owner, vault: null, balance: "0" });
    }
    const balance = await vaultService.getBalance(vaultAddress, owner);
    res.json({ owner, vault: vaultAddress, balance });
  } catch (err) {
    logger.error("Failed to get vault", { owner, error: err });
    res.json({ owner, vault: null, balance: "0" });
  }
});

vaultRoutes.get("/:owner/balance", async (req, res) => {
  const { owner } = req.params;
  try {
    const vaultAddress = await vaultService.getVaultForOwner(owner);
    if (!vaultAddress) {
      return res.json({ balance: "0", currency: "USDC", decimals: 7 });
    }
    const balance = await vaultService.getBalance(vaultAddress, owner);
    res.json({ balance, currency: "USDC", decimals: 7 });
  } catch (err) {
    logger.error("Failed to get vault balance", { owner, error: err });
    res.json({ balance: "0", currency: "USDC", decimals: 7 });
  }
});
