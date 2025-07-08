import type { NextConfig } from 'next';

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

  // Experimental features for Next.js 15
  experimental: {
    // Enable Turbopack for faster builds (Next.js 15 feature)
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
};

export default nextConfig;
