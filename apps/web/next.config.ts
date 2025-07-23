import type { NextConfig } from "next";
import "./env";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@mastra/*", "@lightfast/ai", "@lightfast/types"],
};

export default nextConfig;