/**
 * Composition Manifest — Single Source of Truth
 *
 * To add a new composition:
 * 1. Create the component in src/compositions/<name>/<name>.tsx
 * 2. Add a COMPONENTS entry in Root.tsx
 * 3. Add the composition definition here with its output targets
 * 4. Run: pnpm render:all
 *
 * The manifest drives:
 * - Root.tsx registration (Composition/Still elements)
 * - Rendering (format, scale, codec)
 * - Distribution (auto-copy to destination directories)
 * - Post-processing (favicon.ico bundling)
 */
import type { RenderMediaOptions } from "@vendor/remotion/renderer";

// ── Types ────────────────────────────────────────────────────────────

interface OutputTarget {
  /** Destination directory (relative to monorepo root) */
  dest: string;
  /** Filename override (defaults to `${compositionId}.${format}`) */
  filename?: string;
  /** Output format */
  format: "png" | "webp" | "webm";
  /** For stills extracted from video compositions: which frame to capture */
  frame?: number;
  /** Render scale factor (default: 1) */
  scale?: number;
}

interface StillComposition {
  /** Component name in the COMPONENTS registry in Root.tsx */
  component: string;
  height: number;
  outputs: OutputTarget[];
  props?: Record<string, unknown>;
  type: "still";
  width: number;
}

interface VideoComposition {
  /** Component name in the COMPONENTS registry in Root.tsx */
  component: string;
  durationInFrames: number;
  fps: number;
  height: number;
  outputs: OutputTarget[];
  renderProfile: Pick<
    RenderMediaOptions,
    "codec" | "imageFormat" | "scale" | "everyNthFrame" | "numberOfGifLoops"
  >;
  type: "video";
  width: number;
}

export type CompositionEntry = StillComposition | VideoComposition;

interface PostProcess {
  /** Where to write the .ico */
  dests: string[];
  filename: string;
  /** Composition IDs whose outputs feed into this post-process */
  sources: string[];
  type: "ico";
}

export interface CompositionManifest {
  compositions: Record<string, CompositionEntry>;
  postProcess: PostProcess[];
}

// ── Manifest ─────────────────────────────────────────────────────────

export const MANIFEST: CompositionManifest = {
  compositions: {
    // ── Blog Featured Images ───────────────────────────────────────
    "blog-featured-concentric": {
      type: "still",
      component: "BlogFeaturedConcentric",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-concentric.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-concentric.webp",
          scale: 2,
        },
      ],
    },
    "blog-featured-lissajous": {
      type: "still",
      component: "BlogFeaturedLissajous",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-lissajous.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-lissajous.webp",
          scale: 2,
        },
      ],
    },
    "blog-featured-base": {
      type: "still",
      component: "BlogFeaturedBase",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-base.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-base.webp",
          scale: 2,
        },
      ],
    },
    "blog-featured-rule": {
      type: "still",
      component: "BlogFeaturedRule",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-rule.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-rule.webp",
          scale: 2,
        },
      ],
    },
    "blog-featured-trail": {
      type: "still",
      component: "BlogFeaturedTrail",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-trail.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-trail.webp",
          scale: 2,
        },
      ],
    },
    "blog-featured-ghost": {
      type: "still",
      component: "BlogFeaturedGhost",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-ghost.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-ghost.webp",
          scale: 2,
        },
      ],
    },
    "blog-featured-cross": {
      type: "still",
      component: "BlogFeaturedCross",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-cross.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-cross.webp",
          scale: 2,
        },
      ],
    },

    "blog-featured-duo": {
      type: "still",
      component: "BlogFeaturedDuo",
      width: 1200,
      height: 630,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-duo.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "packages/app-remotion/out/featured",
          filename: "blog-featured-duo.webp",
          scale: 2,
        },
      ],
    },

    "blog-why-we-built-featured": {
      type: "still",
      component: "BlogWhyWeBuiltFeatured",
      width: 1200,
      height: 675,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/www/public/images/blog",
          filename: "why-we-built-lightfast.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "apps/www/public/images/blog",
          filename: "why-we-built-lightfast.webp",
          scale: 2,
        },
      ],
    },

    // ── Changelog Featured Images ─────────────────────────────────
    "changelog-v010-featured": {
      type: "still",
      component: "ChangelogV010Featured",
      width: 1200,
      height: 675,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/www/public/images/changelog",
          filename: "v010-featured.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "apps/www/public/images/changelog",
          filename: "v010-featured.webp",
          scale: 2,
        },
      ],
    },
    "changelog-v010-events": {
      type: "still",
      component: "ChangelogV010Events",
      width: 1200,
      height: 675,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/www/public/images/changelog",
          filename: "v010-events.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "apps/www/public/images/changelog",
          filename: "v010-events.webp",
          scale: 2,
        },
      ],
    },
    "changelog-v010-sources": {
      type: "still",
      component: "ChangelogV010Sources",
      width: 1200,
      height: 675,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/www/public/images/changelog",
          filename: "v010-sources.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "apps/www/public/images/changelog",
          filename: "v010-sources.webp",
          scale: 2,
        },
      ],
    },
    "changelog-v010-sdk-mcp": {
      type: "still",
      component: "ChangelogV010SdkMcp",
      width: 1200,
      height: 675,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/www/public/images/changelog",
          filename: "v010-sdk-mcp.png",
          scale: 2,
        },
        {
          format: "webp",
          dest: "apps/www/public/images/changelog",
          filename: "v010-sdk-mcp.webp",
          scale: 2,
        },
      ],
    },

    // ── Video ──────────────────────────────────────────────────────
    "landing-hero": {
      type: "video",
      component: "LandingHero",
      width: 1920,
      height: 1280,
      fps: 30,
      durationInFrames: 300,
      renderProfile: {
        codec: "vp9",
        imageFormat: "png",
        scale: 2,
      },
      outputs: [
        {
          format: "webm",
          dest: "apps/www/public/images",
          filename: "landing-hero.webm",
        },
        {
          format: "webp",
          dest: "apps/www/public/images",
          filename: "landing-hero-poster.webp",
          frame: 150,
          scale: 1,
        },
      ],
    },

    // ── Favicons ───────────────────────────────────────────────────
    "logo-favicon-16": {
      type: "still",
      component: "Logo",
      width: 16,
      height: 16,
      props: { strokeWidth: 1 },
      outputs: [
        {
          format: "png",
          dest: "apps/app/public",
          filename: "favicon-16x16.png",
        },
        {
          format: "png",
          dest: "apps/www/public",
          filename: "favicon-16x16.png",
        },
      ],
    },
    "logo-favicon-32": {
      type: "still",
      component: "Logo",
      width: 32,
      height: 32,
      props: { strokeWidth: 1.5 },
      outputs: [
        {
          format: "png",
          dest: "apps/app/public",
          filename: "favicon-32x32.png",
        },
        {
          format: "png",
          dest: "apps/www/public",
          filename: "favicon-32x32.png",
        },
      ],
    },
    "logo-favicon-48": {
      type: "still",
      component: "Logo",
      width: 48,
      height: 48,
      props: { strokeWidth: 2 },
      outputs: [
        {
          format: "png",
          dest: "apps/app/public",
          filename: "favicon-48x48.png",
        },
        {
          format: "png",
          dest: "apps/www/public",
          filename: "favicon-48x48.png",
        },
      ],
    },

    // ── Apple & Android Icons ──────────────────────────────────────
    "logo-apple-touch": {
      type: "still",
      component: "Logo",
      width: 180,
      height: 180,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/app/public",
          filename: "apple-touch-icon.png",
        },
        {
          format: "png",
          dest: "apps/www/public",
          filename: "apple-touch-icon.png",
        },
      ],
    },
    "logo-android-192": {
      type: "still",
      component: "Logo",
      width: 192,
      height: 192,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/app/public",
          filename: "android-chrome-192x192.png",
        },
        {
          format: "png",
          dest: "apps/www/public",
          filename: "android-chrome-192x192.png",
        },
      ],
    },
    "logo-android-512": {
      type: "still",
      component: "Logo",
      width: 512,
      height: 512,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "apps/app/public",
          filename: "android-chrome-512x512.png",
        },
        {
          format: "png",
          dest: "apps/www/public",
          filename: "android-chrome-512x512.png",
        },
      ],
    },

    // ── High-res Logomarks ─────────────────────────────────────────
    "logo-1024": {
      type: "still",
      component: "Logo",
      width: 1024,
      height: 1024,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/logos",
          filename: "logo-1024.png",
        },
      ],
    },
    "logo-1024-transparent": {
      type: "still",
      component: "Logo",
      width: 1024,
      height: 1024,
      props: { transparent: true },
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/logos",
          filename: "logo-1024-transparent.png",
        },
      ],
    },

    // ── Social Banners ─────────────────────────────────────────────
    "logo-linkedin-banner": {
      type: "still",
      component: "Logo",
      width: 1584,
      height: 396,
      props: { strokeWidth: 0 },
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/logos",
          filename: "linkedin-banner.png",
        },
      ],
    },
    "twitter-banner": {
      type: "still",
      component: "TwitterBanner",
      width: 1500,
      height: 500,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/logos",
          filename: "twitter-banner.png",
        },
      ],
    },
    "github-banner": {
      type: "still",
      component: "GitHubBanner",
      width: 1280,
      height: 640,
      props: {},
      outputs: [
        {
          format: "png",
          dest: "packages/app-remotion/out/logos",
          filename: "github-banner.png",
          scale: 2,
        },
        {
          format: "png",
          dest: "apps/www/public/images",
          filename: "github-banner.png",
          scale: 2,
        },
      ],
    },
  },

  postProcess: [
    {
      type: "ico",
      sources: ["logo-favicon-16", "logo-favicon-32", "logo-favicon-48"],
      filename: "favicon.ico",
      dests: ["apps/app/public", "apps/www/public"],
    },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Get all still compositions */
export function getStills(): [string, StillComposition][] {
  return Object.entries(MANIFEST.compositions).filter(
    (e): e is [string, StillComposition] => e[1].type === "still"
  );
}

/** Get all video compositions */
export function getVideos(): [string, VideoComposition][] {
  return Object.entries(MANIFEST.compositions).filter(
    (e): e is [string, VideoComposition] => e[1].type === "video"
  );
}
