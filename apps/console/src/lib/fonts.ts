import localFont from "next/font/local";

import { cn } from "@repo/ui/lib/utils";

/**
 * PP Neue Montreal - Primary font family
 * Loaded weights: 100, 400 (+ italic), 500, 600 (+ italic), 700
 */
export const ppNeueMontreal = localFont({
  src: [
    {
      path: "../../../public/fonts/pp-neue-montreal/PPNeueMontreal-Thin.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "../../../public/fonts/pp-neue-montreal/PPNeueMontreal-Book.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/pp-neue-montreal/PPNeueMontreal-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../../public/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/pp-neue-montreal/PPNeueMontreal-SemiBolditalic.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../../public/fonts/pp-neue-montreal/PPNeueMontreal-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-pp-neue-montreal",
  display: "swap",
});

/**
 * Exposure Plus - Secondary font family
 * Loaded weights: 400, 500, 600, 700
 */
export const exposurePlus = localFont({
  src: [
    {
      path: "../../../public/fonts/exposure-plus/exposure-plus-10.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/fonts/exposure-plus/exposure-plus-20.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/fonts/exposure-plus/exposure-plus-30.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../../public/fonts/exposure-plus/exposure-plus-60.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-exposure-plus",
  display: "swap",
});

/**
 * Combined font classes for use in className
 */
export const fonts = cn(
  ppNeueMontreal.variable,
  exposurePlus.variable,
  "touch-manipulation font-sans antialiased",
);
