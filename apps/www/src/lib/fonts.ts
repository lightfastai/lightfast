import localFont from "next/font/local";

/**
 * Geist Sans — variable font, loaded locally so we control the CSS variable
 * name. Matches --font-geist-sans used by @repo/ui globals.css.
 */
export const geistSans = localFont({
  src: "../../public/fonts/geist/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

/**
 * Geist Mono — variable font.
 */
export const geistMono = localFont({
  src: "../../public/fonts/geist/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
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
  display: "swap",
});

/**
 * Exposure Trial - Single weight variant used throughout the app
 * This is a lightweight import for components that need direct className access
 */
export const exposureTrial = localFont({
  src: "../../public/fonts/exposure-plus/exposure-plus-10.woff2",
  variable: "--font-exposure-trial",
  display: "swap",
});

/**
 * PP Supply Sans - Brand logotype font
 */
export const ppSupplySans = localFont({
  src: "../../public/fonts/pp-supply-sans/PPSupplySans-Regular.woff2",
  variable: "--font-pp-supply-sans",
  display: "swap",
});
