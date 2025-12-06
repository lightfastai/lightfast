import { getPage, getPages } from "@/src/lib/source";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeveloperPlatformLanding } from "./_components/developer-platform-landing";
import { DocsLayout } from "@/src/components/docs-layout";
import { mdxComponents } from "@/mdx-components";
import { exposureTrial } from "@/src/lib/fonts";
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

  // Redirect /docs to /docs/get-started/overview
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    redirect("/docs/get-started/overview");
  }

  // TypeScript now knows slug is defined
  const slug = resolvedParams.slug;
  const page = getPage(slug);

  if (!page) {
    return notFound();
  }

  // Show custom landing page for the get-started/overview page
  if (
    slug.length === 2 &&
    slug[0] === "get-started" &&
    slug[1] === "overview"
  ) {
    return <DeveloperPlatformLanding />;
  }

  const MDX = page.data.body;
  const toc = page.data.toc;
  const title = page.data.title;
  const description = page.data.description;

  // Build structured data for SEO
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
    name: "Lightfast Documentation",
    description: "Documentation for Lightfast neural memory — Learn how to integrate team memory via a simple REST API and MCP tools",
    publisher: {
      "@id": "https://lightfast.ai/#organization"
    }
  };

  // Build breadcrumb list
  const breadcrumbItems = slug.map((segment, index) => {
    const url = `/docs/${slug.slice(0, index + 1).join("/")}`;
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
    "@id": `https://lightfast.ai/docs/${slug.join("/")}#breadcrumb`,
    itemListElement: breadcrumbItems
  };

  // Build article entity
  const articleEntity: Article = {
    "@type": "Article",
    "@id": `https://lightfast.ai/docs/${slug.join("/")}#article`,
    headline: title || "Documentation",
    description: description ?? siteConfig.description,
    url: `https://lightfast.ai/docs/${slug.join("/")}`,
    author: {
      "@id": "https://lightfast.ai/#organization"
    },
    publisher: {
      "@id": "https://lightfast.ai/#organization"
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://lightfast.ai/docs/${slug.join("/")}`
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
        {/* Page Header */}
        {(title || description) && (
          <div className="flex w-full flex-col items-center text-center mb-16 max-w-3xl mx-auto">
            {title && (
              <h1
                className={`text-2xl sm:text-3xl md:text-4xl font-light leading-[1.1] tracking-[-0.02em] text-balance ${exposureTrial.className}`}
              >
                {title}
              </h1>
            )}
            {description && (
              <div className="mt-4 w-full">
                <p className="text-base text-muted-foreground">{description}</p>
              </div>
            )}
          </div>
        )}

          <MDX components={mdxComponents} />
        </article>
      </DocsLayout>
    </>
  );
}

export function generateStaticParams() {
  return getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const resolvedParams = await params;

  // Handle root docs metadata
  if (!resolvedParams.slug || resolvedParams.slug.length === 0) {
    return createMetadata({
      title: "Documentation – Lightfast",
      description: "Comprehensive documentation for Lightfast - Team memory and neural search for modern teams",
      image: siteConfig.ogImage,
      metadataBase: new URL(siteConfig.url),
      keywords: [...docsMetadata.keywords],
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
        canonical: `${siteConfig.url}/docs`,
      },
      openGraph: {
        title: "Documentation – Lightfast",
        description: "Comprehensive documentation for Lightfast - Team memory and neural search for modern teams",
        url: `${siteConfig.url}/docs`,
        siteName: "Lightfast Documentation",
        type: "website",
        locale: "en_US",
        images: [
          {
            url: siteConfig.ogImage,
            width: 1200,
            height: 630,
            alt: "Lightfast Documentation",
            type: "image/jpeg",
          }
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: "Documentation – Lightfast",
        description: "Comprehensive documentation for Lightfast - Team memory and neural search for modern teams",
        site: "@lightfastai",
        creator: "@lightfastai",
        images: [siteConfig.ogImage],
      },
      category: "Technology",
    });
  }

  // TypeScript knows slug is defined after the redirect check
  const slug = resolvedParams.slug;
  const page = getPage(slug);

  // Return 404 metadata for missing pages
  if (!page) {
    return createMetadata({
      title: "Page Not Found – Lightfast Docs",
      description: "The requested documentation page could not be found",
      image: siteConfig.ogImage,
      metadataBase: new URL(siteConfig.url),
      robots: {
        index: false,
        follow: false,
      },
    });
  }

  // Build canonical URL for SEO
  const pageUrl = `/docs/${slug.join("/")}`;
  const title = page.data.title ? `${page.data.title} – Lightfast Docs` : "Lightfast Docs";
  const description = page.data.description ?? siteConfig.description;

  // Enhance the metadata with comprehensive SEO properties
  return createMetadata({
    title,
    description,
    image: siteConfig.ogImage,
    metadataBase: new URL(siteConfig.url),
    keywords: [...docsMetadata.keywords],
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
      siteName: "Lightfast Documentation",
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
