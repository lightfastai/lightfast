import localFont from "next/font/local";

/**
 * PP Neue Montreal - Primary font family
 * Only weight 500 (medium) is used in the auth app (headings on sign-in, sign-up, early-access).
 */
export const ppNeueMontreal = localFont({
  src: "../../public/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2",
  weight: "500",
  variable: "--font-pp-neue-montreal",
  display: "swap",
});
