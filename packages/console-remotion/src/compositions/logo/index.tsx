export { Logo } from "./logo";

interface LogoVariant {
  id: string;
  width: number;
  height: number;
  filename: string;
  props: {
    transparent?: boolean;
    strokeWidth?: number;
  };
}

export const LOGO_VARIANTS: LogoVariant[] = [
  // ── Favicons ──────────────────────────────────────────────
  {
    id: "logo-favicon-16",
    width: 16,
    height: 16,
    filename: "favicon-16x16.png",
    props: { strokeWidth: 1 },
  },
  {
    id: "logo-favicon-32",
    width: 32,
    height: 32,
    filename: "favicon-32x32.png",
    props: { strokeWidth: 1.5 },
  },
  {
    id: "logo-favicon-48",
    width: 48,
    height: 48,
    filename: "favicon-48x48.png",
    props: { strokeWidth: 2 },
  },

  // ── Apple Touch Icon ──────────────────────────────────────
  {
    id: "logo-apple-touch",
    width: 180,
    height: 180,
    filename: "apple-touch-icon.png",
    props: {},
  },

  // ── Android Chrome ────────────────────────────────────────
  {
    id: "logo-android-192",
    width: 192,
    height: 192,
    filename: "android-chrome-192x192.png",
    props: {},
  },
  {
    id: "logo-android-512",
    width: 512,
    height: 512,
    filename: "android-chrome-512x512.png",
    props: {},
  },

  // ── High-res logomark ─────────────────────────────────────
  {
    id: "logo-1024",
    width: 1024,
    height: 1024,
    filename: "logo-1024.png",
    props: {},
  },
  {
    id: "logo-1024-transparent",
    width: 1024,
    height: 1024,
    filename: "logo-1024-transparent.png",
    props: { transparent: true },
  },

  // ── Twitter / X banner ─────────────────────────────────────
  {
    id: "logo-twitter-banner",
    width: 1500,
    height: 500,
    filename: "twitter-banner.png",
    props: { strokeWidth: 0 },
  },

  // ── LinkedIn banner ─────────────────────────────────────────
  {
    id: "logo-linkedin-banner",
    width: 1584,
    height: 396,
    filename: "linkedin-banner.png",
    props: { strokeWidth: 0 },
  },
];
