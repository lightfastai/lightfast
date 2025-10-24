import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next/types";
import { withMicrofrontends } from "@vercel/microfrontends/next/config";

import "./src/env";

const withMDX = createMDX();

const config: NextConfig = {
  reactStrictMode: true,
  //  basePath: "/docs",
  // assetPrefix: "/docs",

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: ["@repo/ui", "@repo/url-utils"],
};

export default withMicrofrontends(withMDX(config), { debug: true });
