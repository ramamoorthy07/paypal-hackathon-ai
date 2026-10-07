import type { NextConfig } from "next";

const isStart = process.argv.includes("start");

const nextConfig: NextConfig = {
  // This app is request-dynamic (health, chat, webhooks). Cache Components
  // rejects route segment config like `dynamic = "force-dynamic"`.
  serverExternalPackages: [
    "@libsql/client",
    "@libsql/hrana-client",
    "@paypal/agent-toolkit",
    "@modelcontextprotocol/server",
    "@modelcontextprotocol/sdk",
  ],
};

if (!isStart) {
  nextConfig.turbopack = {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  };
}

export default nextConfig;
