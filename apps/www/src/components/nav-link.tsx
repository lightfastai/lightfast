"use client";

import { Link as MicrofrontendsLink } from "@vercel/microfrontends/next/client";
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
export type NavLinkProps = DistributiveOmit<NavItem, "title"> &
  // Inherits className, onClick, prefetch, target, rel, children, replace, scroll, etc.
  // href is omitted here — it comes from the NavItem discriminated union (typed Route vs string)
  Omit<ComponentPropsWithoutRef<typeof NextLink>, "href"> & {
    // title is required in NavItem data but optional here — children carry the visual label
    title?: string;
  };

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

  const { external: _, microfrontend: __, ...linkProps } = props;
  return <NextLink {...linkProps}>{children}</NextLink>;
}
