import localFont from "next/font/local";

/**
 * Geist Sans — variable font, loaded locally so we control the CSS variable
 * name. Matches --font-geist-sans used by @repo/ui-v2 globals.css.
 */
export const geistSans = localFont({
  src: "../../../../packages/ui-v2/public/fonts/geist/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

/**
 * Geist Mono — variable font.
 */
export const geistMono = localFont({
  src: "../../../../packages/ui-v2/public/fonts/geist/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

/**
 * PP Neue Montreal - Primary sans-serif font
 * Loaded weights: 400 (Book), 500 (Medium)
 */
export const ppNeueMontreal = localFont({
  src: [
    {
      path: "../../../../packages/ui-v2/public/fonts/pp-neue-montreal/PPNeueMontreal-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../../packages/ui-v2/public/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-pp-neue-montreal",
  display: "swap",
});

/**
 * Roobert - wordmark font used by the current landing lockup.
 */
export const roobert = localFont({
  src: [
    {
      path: "../../../../packages/ui-v2/public/fonts/roobert/Roobert-TRIAL-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../../packages/ui-v2/public/fonts/roobert/Roobert-TRIAL-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-roobert-trial",
  display: "swap",
});
