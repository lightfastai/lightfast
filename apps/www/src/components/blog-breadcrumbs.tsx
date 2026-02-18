import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd   } from "@vendor/seo/json-ld";
import type {BreadcrumbList, WithContext} from "@vendor/seo/json-ld";

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  // Generate structured data for breadcrumbs
  const structuredData: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href
        ? {
            item: `https://lightfast.ai${item.href}`,
          }
        : {}),
    })),
  };

  return (
    <>
      <JsonLd code={structuredData} />
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}
      >
        {items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.name}
              </Link>
            ) : (
              <span className="text-foreground">{item.name}</span>
            )}
          </div>
        ))}
      </nav>
    </>
  );
}