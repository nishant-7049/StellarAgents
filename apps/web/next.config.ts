import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Bundle local workspace packages and ESM-only packages from source
  // so production builds don't require pre-built dist folders
  transpilePackages: [
    "@agenticocean/x402-stellar",
    "recharts",
  ],
  experimental: {
    serverActions: {},
  },
};

export default nextConfig;
