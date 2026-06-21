// @ts-check
import vercel from '@astrojs/vercel';
import sentry from '@sentry/astro';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';
import { visualizer } from 'rollup-plugin-visualizer';

const analyze = process.env.ANALYZE === 'true';
const canUploadSentrySourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT,
);
const vitePlugins = [...tailwindcss()];

if (analyze) {
  vitePlugins.push(
    visualizer({
      emitFile: true,
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  );
}

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
  ],
  integrations: [
    sentry({
      enabled: {
        client: true,
        server: false,
      },
      clientInitPath: './sentry.client.config.ts',
      autoInstrumentation: {
        requestHandler: false,
      },
      sourcemaps: {
        disable: !canUploadSentrySourceMaps,
      },
      telemetry: false,
      silent: !process.env.CI,
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeTracing: true,
        excludeReplayShadowDom: true,
        excludeReplayIframe: true,
        excludeReplayWorker: true,
      },
    }),
  ],
  vite: {
    plugins: vitePlugins,
  },
});
