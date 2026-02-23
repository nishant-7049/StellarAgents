export async function isFreighterInstalled(): Promise<boolean> {
  try {
    const { isConnected } = await import("@stellar/freighter-api");
    return await isConnected();
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  const { requestAccess } = await import("@stellar/freighter-api");
  return await requestAccess();
}

export async function getPublicKey(): Promise<string | null> {
  try {
    const mod = await import("@stellar/freighter-api");
    return await mod.getPublicKey();
  } catch {
    return null;
  }
}

export async function signTransaction(xdr: string): Promise<string> {
  const { signTransaction: sign } = await import("@stellar/freighter-api");
  const networkPassphrase = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "";
  if (!networkPassphrase) {
    throw new Error("Missing NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE");
  }
  return await sign(xdr, {
    networkPassphrase,
  });
}
