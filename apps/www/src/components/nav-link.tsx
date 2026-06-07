"use client";

import { Link as MicrofrontendsLink } from "@vercel/microfrontends/next/client";
import type { Route } from "next";
import NextLink from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import type { NavItem } from "~/types/nav";

/**
 * Omit distributed across each union member, preserving discriminated union structure.
 * Plain `Omit<A | B | C, K>` collapses the union into a flat object — discriminants are
 * lost and TypeScript can no longer narrow. This utility keeps A | B | C intact.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * A Link component that handles all three NavItem variants with full type safety.
 *
 * - Internal routes (default)  → next/link            href: Route (typed)
 * - Microfrontend routes        → microfrontends Link  href: string (cross-zone)
 * - External links              → <a>                  href: string (mailto:, https://, etc.)
 *
 * Spreading a NavItem directly is supported:
 *   <NavLink {...item} className="..." onClick={...}>{item.title}</NavLink>
 *
 * Standalone use (title not required):
 *   <NavLink href="/">Home</NavLink>
 */
type NavLinkProps = DistributiveOmit<NavItem, "title"> &
  // Inherits className, onClick, prefetch, target, rel, children, replace, scroll, etc.
  // href is omitted here — it comes from the NavItem discriminated union (typed Route vs string)
  Omit<ComponentPropsWithoutRef<typeof NextLink>, "href"> & {
    // title is required in NavItem data but optional here — children carry the visual label
    title?: string;
  };

const wwwStartRoutes = new Set([
  "/",
  "/blog",
  "/careers",
  "/changelog",
  "/company",
  "/docs",
  "/docs/get-started/overview",
  "/legal/privacy",
  "/legal/terms",
  "/pricing",
  "/search",
  "/use-cases/agent-builders",
  "/use-cases/engineering-leaders",
  "/use-cases/platform-engineers",
  "/use-cases/technical-founders",
]);

function getPathname(href: string) {
  const path = href.startsWith("/") ? href : `/${href}`;
  return path.split(/[?#]/, 1)[0] || "/";
}

function isWwwStartPath(href: string) {
  const pathname = getPathname(href);

  return (
    wwwStartRoutes.has(pathname) ||
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/changelog/") ||
    pathname.startsWith("/company/") ||
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/use-cases/")
  );
}

export function NavLink({
  // NavItem data fields — consumed here, not forwarded to the DOM
  title: _title,
  icon: _icon,
  label: _label,
  disabled: _disabled,
  children,
  ...props
}: NavLinkProps) {
  if (props.external) {
    const { external: _, microfrontend: __, ...anchorProps } = props;
    return <a {...anchorProps}>{children}</a>;
  }

  if (props.microfrontend) {
    const { external: _, microfrontend: __, ...anchorProps } = props;
    return <MicrofrontendsLink {...anchorProps}>{children}</MicrofrontendsLink>;
  }

  if (isWwwStartPath(props.href)) {
    const { external: _, microfrontend: __, ...anchorProps } = props;
    return <MicrofrontendsLink {...anchorProps}>{children}</MicrofrontendsLink>;
  }

  const { external: _, microfrontend: __, href, ...linkProps } = props;
  return (
    <NextLink {...linkProps} href={href as Route}>
      {children}
    </NextLink>
  );
}
