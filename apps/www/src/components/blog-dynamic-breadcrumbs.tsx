"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs, type BreadcrumbItem } from "~/components/blog-breadcrumbs";

interface DynamicBreadcrumbsProps {
  categories: Array<{
    _slug?: string | null;
    _title?: string | null;
  }>;
}

export function DynamicBreadcrumbs({ categories }: DynamicBreadcrumbsProps) {
  const pathname = usePathname();

  // Build breadcrumb items based on current path
  const breadcrumbItems: BreadcrumbItem[] = [
    { name: "Home", href: "/" },
    { name: "Blog", href: "/blog" },
  ];

  // Check if we're on a category page
  const categoryMatch = pathname.match(/\/blog\/topic\/([^/]+)/);
  if (categoryMatch) {
    const categorySlug = categoryMatch[1];
    const category = categories.find(c => c._slug === categorySlug);
    if (category?._title) {
      breadcrumbItems.push({ name: category._title });
    }
  }

  return <Breadcrumbs items={breadcrumbItems} className="mb-8" />;
}