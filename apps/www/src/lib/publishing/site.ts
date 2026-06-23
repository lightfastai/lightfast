export const SITE = {
  name: "Lightfast",
  baseUrl: "https://lightfast.ai",
  twitterHandle: "@lightfastai",
  defaultOgImage: {
    url: "https://lightfast.ai/opengraph-image",
    width: 1200,
    height: 630,
    alt: "Lightfast - The Operating Layer for Agents and Apps",
  },
  homeOgImage: {
    url: "https://lightfast.ai/opengraph-image",
    width: 1200,
    height: 630,
    alt: "Lightfast - Human-AI Collaboration Lab",
  },
  organizationId: "https://lightfast.ai/#organization",
  websiteId: "https://lightfast.ai/#website",
  logoUrl: "https://lightfast.ai/android-chrome-512x512.png",
  sameAs: [
    "https://x.com/lightfastai",
    "https://github.com/lightfastai",
    "https://www.linkedin.com/company/lightfastai",
  ],
} as const;

export function absoluteUrl(pathname: string): string {
  return pathname === "/" ? SITE.baseUrl : `${SITE.baseUrl}${pathname}`;
}
