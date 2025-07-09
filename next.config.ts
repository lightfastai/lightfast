import type { NextConfig } from 'next';

import 'env';

const nextConfig: NextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,

  // Configure TypeScript
  typescript: {
    // Don't fail production builds if TypeScript errors exist
    ignoreBuildErrors: false,
  },

  // Configure ESLint
  eslint: {
    // Run ESLint during production builds
    ignoreDuringBuilds: false,
  },

  // Turbopack configuration (stable in Next.js 15)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;
