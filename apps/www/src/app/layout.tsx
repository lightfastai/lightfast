import "~/styles/styles.css";

import { cn } from "@repo/ui-v2/lib/utils";
import { SpeedInsights, VercelAnalytics } from "@vendor/analytics/vercel";
import { JsonLd } from "@vendor/seo/json-ld";
import {
  PrefetchCrossZoneLinks,
  PrefetchCrossZoneLinksProvider,
} from "@vercel/microfrontends/next/client";

import localFont from "next/font/local";
import {
  buildRootJsonLd,
  rootMetadata,
  rootViewport,
} from "~/lib/site/identity";

const geistSans = localFont({
  src: "../../public/fonts/subsets/Geist-Variable-www-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../../public/fonts/subsets/GeistMono-Variable-www-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  preload: false,
});

const ppNeueMontreal = localFont({
  src: [
    {
      path: "../../public/fonts/subsets/PPNeueMontreal-Medium-www-latin.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-pp-neue-montreal",
  display: "swap",
});

export const metadata = rootMetadata;

export const viewport = rootViewport;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rootJsonLd = buildRootJsonLd();

  return (
    <html
      className={cn(
        geistSans.variable,
        geistMono.variable,
        ppNeueMontreal.variable,
        "dark scrollbar-thin touch-manipulation font-sans antialiased"
      )}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        {rootJsonLd.map((schema, index) => (
          <JsonLd code={schema} key={`root-json-ld-${index}`} />
        ))}
      </head>
      <body>
        <PrefetchCrossZoneLinksProvider>
          {children}
          <VercelAnalytics />
          <SpeedInsights />
          <PrefetchCrossZoneLinks />
        </PrefetchCrossZoneLinksProvider>
      </body>
    </html>
  );
}
