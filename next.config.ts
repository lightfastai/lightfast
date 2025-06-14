import type { NextConfig } from "next"
import { createMDX } from "fumadocs-mdx/next"
import "@/env"

const withMDX = createMDX()

const nextConfig: NextConfig = {
  // App Router is enabled by default in Next.js 13+
  experimental: {
    ppr: true,
  },
}

export default withMDX(nextConfig)
