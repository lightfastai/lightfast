import localFont from "next/font/local";

/**
 * Geist Sans — variable font, loaded locally so we control the CSS variable
 * name. Matches --font-geist-sans used by @repo/ui-v2 globals.css.
 */
export const geistSans = localFont({
  src: "../fonts/subsets/Geist-Variable-www-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

/**
 * Geist Mono — variable font.
 */
export const geistMono = localFont({
  src: "../fonts/subsets/GeistMono-Variable-www-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

/**
 * PP Neue Montreal - Primary sans-serif font
 * Loaded weights: 500 (Medium)
 */
export const ppNeueMontreal = localFont({
  src: [
    {
      path: "../fonts/subsets/PPNeueMontreal-Medium-www-latin.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-pp-neue-montreal",
  display: "swap",
});
