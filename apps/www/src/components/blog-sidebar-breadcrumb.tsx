import Link from "next/link";
import type { BreadcrumbList, WithContext } from "@vendor/seo/json-ld";
import { JsonLd } from "@vendor/seo/json-ld";

interface SidebarBreadcrumbProps {
  categoryName?: string | null;
  postTitle: string;
  postSlug: string;
}

export function SidebarBreadcrumb({
  categoryName,
  postTitle,
  postSlug,
}: SidebarBreadcrumbProps) {
  // Generate structured data for breadcrumbs
  const structuredData: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://lightfast.ai/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://lightfast.ai/blog",
      },
      ...(categoryName
        ? [
            {
              "@type": "ListItem" as const,
              position: 3,
              name: categoryName,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: categoryName ? 4 : 3,
        name: postTitle,
        item: `https://lightfast.ai/blog/${postSlug}`,
      },
    ],
  };

  const breadcrumbNav = (
    <nav
      aria-label="Breadcrumb"
      className="text-sm text-muted-foreground"
    >
      <Link
        href="/blog"
        className="hover:text-foreground transition-colors"
      >
        Blog
      </Link>
      {categoryName && (
        <>
          <span className="mx-1">/</span>
          <span className="text-foreground">{categoryName}</span>
        </>
      )}
    </nav>
  );

  return (
    <>
      {/* JSON-LD structured data - rendered once */}
      <JsonLd code={structuredData} />

      {/* Mobile: above content */}
      <div className="md:hidden mb-8">
        {breadcrumbNav}
      </div>

      {/* Desktop: left sidebar */}
      <div className="hidden md:block md:col-span-2 lg:col-span-3">
        <div className="w-48">
          {breadcrumbNav}
        </div>
      </div>
    </>
  );
}
