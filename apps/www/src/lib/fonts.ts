import localFont from "next/font/local";

// preload: false on ALL fonts — Vercel's microfrontend proxy rewrites
// <link rel="preload"> URLs to include the app prefix (vc-ap-fb51eb/...)
// but CSS @font-face declarations still reference the original
// /_next/static/media/ paths. The browser treats these as different URLs
// and downloads each font twice. Disabling preload means fonts load only
// via @font-face (single download, ~600 KB saved on every mobile page load).

/**
 * Geist Sans — variable font, replaces geist/font/sans import so we can
 * set preload: false. CSS variable matches the one set by the geist package
 * so @repo/ui globals.css (--font-sans: var(--font-geist-sans)) still works.
 */
export const geistSans = localFont({
  src: "../../public/fonts/geist/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  preload: false,
  display: "swap",
});

/**
 * Geist Mono — variable font, same rationale as geistSans above.
 */
export const geistMono = localFont({
  src: "../../public/fonts/geist/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  preload: false,
  display: "swap",
});

/**
 * PP Neue Montreal - Primary sans-serif font
 * Loaded with 6 weights: 100 (Thin), 400 (Book), 400 italic, 500 (Medium), 600 italic (SemiBold), 700 (Bold)
 */
export const ppNeueMontreal = localFont({
  src: [
    {
      path: "../../public/fonts/pp-neue-montreal/PPNeueMontreal-Thin.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../public/fonts/pp-neue-montreal/PPNeueMontreal-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/pp-neue-montreal/PPNeueMontreal-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/pp-neue-montreal/PPNeueMontreal-SemiBolditalic.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../public/fonts/pp-neue-montreal/PPNeueMontreal-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-pp-neue-montreal",
  preload: false,
  display: "swap",
});

/**
 * Exposure Plus - Display font for headings
 * Loaded with 4 weights: 400, 500, 600, 700
 */
export const exposurePlus = localFont({
  src: [
    {
      path: "../../public/fonts/exposure-plus/exposure-plus-10.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/exposure-plus/exposure-plus-20.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/exposure-plus/exposure-plus-30.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/exposure-plus/exposure-plus-60.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-exposure-plus",
  preload: false,
  display: "swap",
});

/**
 * Exposure Trial - Single weight variant used throughout the app
 * This is a lightweight import for components that need direct className access
 */
export const exposureTrial = localFont({
  src: "../../public/fonts/exposure-plus/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
  preload: false,
  display: "swap",
});
