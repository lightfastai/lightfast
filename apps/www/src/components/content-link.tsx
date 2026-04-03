import type { Route } from "next";
import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Bridge component for fumadocs runtime URLs.
 *
 * Fumadocs page-tree and search APIs return URLs as `string` (e.g. page.url,
 * child.url, result.url). These ARE valid internal routes at runtime, but
 * fumadocs does not brand them with Next.js Route<T>.
 *
 * ContentLink is the single audit point for "we trust fumadocs returns valid routes".
 * Use next/link directly for routes you control; use ContentLink only for URLs
 * that originate from fumadocs at runtime.
 */
type ContentLinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & {
  href: string;
};

export function ContentLink({ href, ...props }: ContentLinkProps) {
  return <Link href={href as Route} {...props} />;
}
