import type { Thing, WithContext } from "@vendor/seo/json-ld";
import type { Metadata, MetadataRoute, Viewport } from "next";

const baseUrl = "https://lightfast.ai";
const defaultTitle = "Lightfast - Collaboration between humans and machine";
const defaultDescription =
  "Lightfast is an applied AI lab building systems where product and engineering teams design, build, and ship with AI in real time.";
const defaultOgDescription =
  "An applied AI lab developing models, interfaces, infrastructure, and evals for teams working with AI in real time.";

export const SITE_IDENTITY = {
  name: "Lightfast",
  shortName: "Lightfast",
  title: defaultTitle,
  description: defaultDescription,
  ogDescription: defaultOgDescription,
  baseUrl,
  twitterHandle: "@lightfastai",
  category: "Technology",
  classification: "Applied AI Lab",
  locale: "en_US",
  language: "en-US",
  themeColor: "#09090b",
  organizationId: `${baseUrl}/#organization`,
  websiteId: `${baseUrl}/#website`,
  logoUrl: `${baseUrl}/android-chrome-512x512.png`,
  defaultOgImage: {
    url: `${baseUrl}/opengraph-image`,
    width: 1200,
    height: 630,
    alt: defaultTitle,
  },
  icons: {
    favicon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    favicon32: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
    android192: "/android-chrome-192x192.png",
    android512: "/android-chrome-512x512.png",
  },
  contact: {
    email: "hello@lightfast.ai",
    founder: {
      name: "Jeevan Pillay",
      email: "jp@lightfast.ai",
      url: "https://twitter.com/jeevanpillay",
    },
  },
  socialLinks: [
    { label: "X", url: "https://x.com/lightfastai" },
    { label: "GitHub", url: "https://github.com/lightfastai" },
    {
      label: "LinkedIn",
      url: "https://www.linkedin.com/company/lightfastai",
    },
    { label: "Discord", url: "https://discord.gg/YqPDfcar2C" },
  ],
  authorityLinks: [
    {
      title: "Lightfast on GitHub",
      url: "https://github.com/lightfastai",
      description: "Official Lightfast GitHub organization.",
    },
    {
      title: "Lightfast SDK on npm",
      url: "https://www.npmjs.com/package/lightfast",
      description: "The Lightfast TypeScript SDK package.",
    },
    {
      title: "Lightfast MCP server on npm",
      url: "https://www.npmjs.com/package/@lightfastai/mcp",
      description: "The Lightfast MCP server package for AI agents.",
    },
  ],
} as const;

export const SITE = SITE_IDENTITY;

type OrganizationEntity = Extract<Thing, { "@type": "Organization" }>;
type WebSiteEntity = Extract<Thing, { "@type": "WebSite" }>;

export function absoluteUrl(pathname: string): string {
  const normalizedPathname = pathname.startsWith("/")
    ? pathname
    : `/${pathname}`;
  return normalizedPathname === "/"
    ? SITE_IDENTITY.baseUrl
    : `${SITE_IDENTITY.baseUrl}${normalizedPathname}`;
}

export function buildOrganizationEntity(): OrganizationEntity {
  return {
    "@type": "Organization",
    "@id": SITE_IDENTITY.organizationId,
    name: SITE_IDENTITY.name,
    url: SITE_IDENTITY.baseUrl,
    logo: {
      "@type": "ImageObject",
      url: SITE_IDENTITY.logoUrl,
    },
    sameAs: SITE_IDENTITY.socialLinks.map((link) => link.url),
  };
}

export function buildWebSiteEntity(): WebSiteEntity {
  return {
    "@type": "WebSite",
    "@id": SITE_IDENTITY.websiteId,
    name: SITE_IDENTITY.name,
    url: SITE_IDENTITY.baseUrl,
    publisher: { "@id": SITE_IDENTITY.organizationId },
  };
}

export function buildRootJsonLd(): readonly [
  WithContext<OrganizationEntity>,
  WithContext<WebSiteEntity>,
] {
  return [
    {
      "@context": "https://schema.org",
      ...buildOrganizationEntity(),
    } satisfies WithContext<OrganizationEntity>,
    {
      "@context": "https://schema.org",
      ...buildWebSiteEntity(),
    } satisfies WithContext<WebSiteEntity>,
  ];
}

export const rootMetadata: Metadata = {
  title: SITE_IDENTITY.title,
  description: SITE_IDENTITY.description,
  applicationName: SITE_IDENTITY.name,
  metadataBase: new URL(SITE_IDENTITY.baseUrl),
  authors: [
    {
      name: SITE_IDENTITY.name,
      url: SITE_IDENTITY.baseUrl,
    },
  ],
  creator: SITE_IDENTITY.name,
  publisher: SITE_IDENTITY.name,
  category: SITE_IDENTITY.category,
  classification: SITE_IDENTITY.classification,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: SITE_IDENTITY.locale,
    url: SITE_IDENTITY.baseUrl,
    title: SITE_IDENTITY.title,
    description: SITE_IDENTITY.ogDescription,
    siteName: SITE_IDENTITY.name,
    images: [SITE_IDENTITY.defaultOgImage],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_IDENTITY.twitterHandle,
    creator: SITE_IDENTITY.twitterHandle,
    title: SITE_IDENTITY.title,
    description: SITE_IDENTITY.ogDescription,
    images: [SITE_IDENTITY.defaultOgImage.url],
  },
  icons: {
    icon: SITE_IDENTITY.icons.favicon,
    shortcut: SITE_IDENTITY.icons.shortcut,
    apple: SITE_IDENTITY.icons.apple,
    other: [
      {
        rel: "icon",
        url: SITE_IDENTITY.icons.favicon32,
        sizes: "32x32",
      },
      {
        rel: "icon",
        url: SITE_IDENTITY.icons.android192,
        sizes: "192x192",
      },
      {
        rel: "icon",
        url: SITE_IDENTITY.icons.android512,
        sizes: "512x512",
      },
    ],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_IDENTITY.name,
    startupImage: SITE_IDENTITY.icons.apple,
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: SITE_IDENTITY.baseUrl,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const rootViewport: Viewport = {
  themeColor: SITE_IDENTITY.themeColor,
};

export function buildSiteManifest(): MetadataRoute.Manifest {
  return {
    name: SITE_IDENTITY.title,
    short_name: SITE_IDENTITY.shortName,
    description: SITE_IDENTITY.description,
    start_url: "/",
    display: "standalone",
    background_color: SITE_IDENTITY.themeColor,
    theme_color: SITE_IDENTITY.themeColor,
    icons: [
      {
        src: SITE_IDENTITY.icons.favicon,
        sizes: "48x48",
        type: "image/x-icon",
      },
      {
        src: SITE_IDENTITY.icons.apple,
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: SITE_IDENTITY.icons.android192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: SITE_IDENTITY.icons.android512,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
