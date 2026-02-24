import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/providers/WalletProvider";
import { ToastProvider } from "@/providers/ToastProvider";

export const metadata: Metadata = {
  title: "AgentNet - AI Agent Wallets on Stellar",
  description: "Give your AI agents a wallet on Stellar. Smart vaults with delegated spending powered by x402.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <WalletProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
