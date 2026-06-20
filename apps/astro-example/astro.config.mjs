// @ts-check
import vercel from '@astrojs/vercel';
import { defineConfig, fontProviders } from 'astro/config';
import { visualizer } from 'rollup-plugin-visualizer';

const analyze = process.env.ANALYZE === 'true';

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Geist',
      cssVariable: '--font-geist',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/geist/Geist-Variable-Latin.woff2'],
            style: 'normal',
            weight: '100 900',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'PP Neue Montreal',
      cssVariable: '--font-pp-neue-montreal',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/pp-neue-montreal/PPNeueMontreal-Medium-Landing.woff2'],
            style: 'normal',
            weight: 500,
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Roobert Trial',
      cssVariable: '--font-roobert-trial',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/roobert/Roobert-TRIAL-Medium-Wordmark.woff2'],
            style: 'normal',
            weight: 500,
          },
        ],
      },
    },
  ],
  vite: {
    plugins: analyze
      ? [
          visualizer({
            emitFile: true,
            filename: 'stats.html',
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : [],
  },
});
