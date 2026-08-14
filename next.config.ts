import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // @mastra/mcp ships a stdio transport that reaches for node:child_process —
  // keep it out of the bundler and let Node require it at runtime.
  serverExternalPackages: ["@mastra/mcp"],
};

export default nextConfig;
