import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next/types";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "./src/env";

const withMDX = createMDX();

const config: NextConfig = {
  reactStrictMode: true,

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@repo/ui", "@repo/url-utils", "@vendor/seo"],
};

// Use withMicrofrontends (www will start the proxy automatically)
export default withMicrofrontends(withMDX(config), { debug: true });
