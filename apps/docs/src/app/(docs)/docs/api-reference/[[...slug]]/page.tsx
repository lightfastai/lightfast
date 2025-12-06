import { getApiPage, getApiPages } from "@/src/lib/source";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DocsLayout } from "@/src/components/docs-layout";
import { mdxComponents } from "@/mdx-components";
import { siteConfig, docsMetadata } from "@/src/lib/site-config";
import { createMetadata } from "@vendor/seo/metadata";
import { JsonLd } from "@vendor/seo/json-ld";
import type {
  GraphContext,
  Organization,
  WebSite,
  Article,
  BreadcrumbList,
} from "@vendor/seo/json-ld";

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const resolvedParams = await params;

  // Redirect /docs/api-reference to /docs/api-reference/overview
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/docs/api-reference/overview");
  }

  // TypeScript now knows slug is defined
  const slug = resolvedParams.slug;
  const page = getApiPage(slug);

  if (!page) {
    return notFound();
  }

  const MDX = page.data.body;
  const toc = page.data.toc;
  const title = page.data.title;
  const description = page.data.description;

  // Build structured data for API Reference pages
  const organizationEntity: Organization = {
    "@type": "Organization",
    "@id": "https://lightfast.ai/#organization",
    name: "Lightfast",
    url: "https://lightfast.ai",
    logo: {
      "@type": "ImageObject",
      url: "https://lightfast.ai/android-chrome-512x512.png",
    },
    sameAs: [
      "https://twitter.com/lightfastai",
      "https://github.com/lightfastai",
      "https://www.linkedin.com/company/lightfastai"
    ],
    description: "Lightfast is memory built for teams. We help people and agents find what they need, understand context, and trace decisions across their entire organization."
  };

  const websiteEntity: WebSite = {
    "@type": "WebSite",
    "@id": "https://lightfast.ai/docs#website",
    url: "https://lightfast.ai/docs",
    name: "Lightfast API Reference",
    description: "API Reference for Lightfast neural memory — REST API and MCP tools documentation",
    publisher: {
      "@id": "https://lightfast.ai/#organization"
    }
  };

  // Build breadcrumb list
  const fullPath = ["api-reference", ...slug];
  const breadcrumbItems = fullPath.map((segment, index) => {
    const url = `/docs/${fullPath.slice(0, index + 1).join("/")}`;
    const name = segment.split("-").map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");

    return {
      "@type": "ListItem" as const,
      position: index + 1,
      name,
      item: `https://lightfast.ai${url}`
    };
  });

  const breadcrumbList: BreadcrumbList = {
    "@type": "BreadcrumbList",
    "@id": `https://lightfast.ai/docs/api-reference/${slug.join("/")}#breadcrumb`,
    itemListElement: breadcrumbItems
  };

  // Build article entity
  const articleEntity: Article = {
    "@type": "Article",
    "@id": `https://lightfast.ai/docs/api-reference/${slug.join("/")}#article`,
    headline: title || "API Reference",
    description: description ?? "API documentation for Lightfast neural memory",
    url: `https://lightfast.ai/docs/api-reference/${slug.join("/")}`,
    author: {
      "@id": "https://lightfast.ai/#organization"
    },
    publisher: {
      "@id": "https://lightfast.ai/#organization"
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://lightfast.ai/docs/api-reference/${slug.join("/")}`
    }
  };

  const structuredData: GraphContext = {
    "@context": "https://schema.org",
    "@graph": [
      organizationEntity,
      websiteEntity,
      breadcrumbList,
      articleEntity
    ]
  };

  return (
    <>
      <JsonLd code={structuredData} />
      <DocsLayout toc={toc}>
        <article className="max-w-none">
          <MDX components={mdxComponents} />
        </article>
      </DocsLayout>
    </>
  );
}

export function generateStaticParams() {
  return getApiPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;

  // Handle root API reference metadata
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    return createMetadata({
      title: "API Reference – Lightfast",
      description: "Complete API reference for Lightfast neural memory. REST endpoints and MCP tools for team memory integration.",
      image: siteConfig.ogImage,
      metadataBase: new URL(siteConfig.url),
      keywords: [
        "API reference",
        "REST API",
        "MCP tools",
        "developer documentation",
        ...docsMetadata.keywords
      ],
      authors: [...docsMetadata.authors],
      creator: docsMetadata.creator,
      publisher: docsMetadata.creator,
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
      alternates: {
        canonical: `${siteConfig.url}/docs/api-reference`,
      },
      openGraph: {
        title: "API Reference – Lightfast",
        description: "Complete API reference for Lightfast neural memory. REST endpoints and MCP tools for team memory integration.",
        url: `${siteConfig.url}/docs/api-reference`,
        siteName: "Lightfast Documentation",
        type: "website",
        locale: "en_US",
        images: [
          {
            url: siteConfig.ogImage,
            width: 1200,
            height: 630,
            alt: "Lightfast API Reference",
            type: "image/jpeg",
          }
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "API Reference – Lightfast",
        description: "Complete API reference for Lightfast neural memory. REST endpoints and MCP tools.",
        site: "@lightfastai",
        creator: "@lightfastai",
        images: [siteConfig.ogImage],
      },
      category: "Technology",
    });
  }

  // TypeScript knows slug is defined after the redirect check
  const slug = resolvedParams.slug;
  const page = getApiPage(slug);

  // Return 404 metadata for missing pages
  if (!page) {
    return createMetadata({
      title: "Page Not Found – Lightfast API Reference",
      description: "The requested API documentation page could not be found",
      image: siteConfig.ogImage,
      metadataBase: new URL(siteConfig.url),
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  // Build canonical URL for SEO
  const pageUrl = `/docs/api-reference/${slug.join("/")}`;
  const title = page.data.title ? `${page.data.title} – Lightfast API` : "Lightfast API Reference";
  const description = page.data.description ?? "API documentation for Lightfast neural memory";

  return createMetadata({
    title,
    description,
    image: siteConfig.ogImage,
    metadataBase: new URL(siteConfig.url),
    keywords: ["API reference", "REST API", "MCP tools", ...docsMetadata.keywords],
    authors: [...docsMetadata.authors],
    creator: docsMetadata.creator,
    publisher: docsMetadata.creator,
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
    alternates: {
      canonical: `${siteConfig.url}${pageUrl}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}${pageUrl}`,
      siteName: "Lightfast API Reference",
      type: "article",
      locale: "en_US",
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/jpeg",
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: "@lightfastai",
      creator: "@lightfastai",
      images: [siteConfig.ogImage],
    },
    category: "Technology",
  });
}