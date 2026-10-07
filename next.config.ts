import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app is request-dynamic (health, chat, webhooks). Cache Components
  // rejects route segment config like `dynamic = "force-dynamic"`.
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
