import type { NextConfig } from "next";
import "./env";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@mastra/*", 
    "@lightfast/ai", 
    "@lightfast/types",
    "@libsql/client",
    "playwright-core",
    "playwright",
    "chromium-bidi",
    "@browserbasehq/stagehand"
  ],
};

export default nextConfig;
