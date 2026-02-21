# Connect Your Wallet

The dashboard uses [Freighter](https://freighter.app) — a browser extension wallet for Stellar.

---

## Install Freighter

1. Visit [freighter.app](https://freighter.app)
2. Install the browser extension (Chrome, Firefox, or Brave)
3. Create a new wallet or import an existing one with your secret key

---

## Connect to the Dashboard

1. Open the dashboard at `http://localhost:3000`
2. Click **Connect Wallet** in the top-right corner
3. Freighter will ask for permission — click **Connect**
4. Your public key (G...) appears in the top-right once connected

---

## Switch to Testnet

Make sure Freighter is set to **Testnet**:

1. Open Freighter extension
2. Click the network dropdown (top of the extension)
3. Select **Testnet**

The dashboard shows a **Testnet** badge in the top navigation when connected to testnet.

---

## Fund Your Account

For testnet, get free XLM from Stellar Friendbot:

```
https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY
```

This gives you 10,000 XLM — enough for thousands of testnet transactions.

---

## Mainnet (Public Network)

For mainnet:

1. Open Freighter
2. Switch network to **Public**
3. Fund your account with real XLM (fees) and deposit real USDC before using x402 flows

There is **no Friendbot** on mainnet. See: [Mainnet guide](../getting-started/mainnet.md)

---

## Troubleshooting

**"Freighter not detected"** — Make sure the extension is installed and enabled in your browser.

**Wrong network** — If you see a network mismatch warning, switch Freighter to Testnet.

**Transaction rejected** — Freighter requires XLM for transaction fees. Make sure your account is funded.

**Account not found** — New Stellar accounts need at least one transaction (like a Friendbot airdrop) to be activated on the network.
