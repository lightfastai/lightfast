import type { ComponentPropsWithoutRef } from "react";
import { clientEnv } from "~/env/client";
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
 * - Internal root route         → local href
 * - Delegated app/www routes    → absolute Portless service href
 * - External links              → <a>                  href: string (mailto:, https://, etc.)
 *
 * Spreading a NavItem directly is supported:
 *   <NavLink {...item} className="..." onClick={...}>{item.title}</NavLink>
 *
 * Standalone use (title not required):
 *   <NavLink href="/">Home</NavLink>
 */
type NavLinkProps = DistributiveOmit<NavItem, "title"> &
  Omit<ComponentPropsWithoutRef<"a">, "href"> & {
    // title is required in NavItem data but optional here — children carry the visual label
    title?: string;
    prefetch?: boolean;
  };

const migratedWwwStartRoutes = new Set([
  "/blog",
  "/careers",
  "/changelog",
  "/company",
  "/docs",
  "/docs/get-started/overview",
  "/legal/privacy",
  "/legal/terms",
  "/pricing",
  "/use-cases/agent-builders",
  "/use-cases/engineering-leaders",
  "/use-cases/platform-engineers",
  "/use-cases/technical-founders",
]);

function isMigratedWwwStartPath(pathname: string) {
  return (
    migratedWwwStartRoutes.has(pathname) ||
    pathname.startsWith("/blog/") ||
    pathname.startsWith("/changelog/")
  );
}

function joinUrl(baseUrl: string, href: string) {
  if (href.startsWith("http") || href.startsWith("mailto:")) {
    return href;
  }

  const base = baseUrl.replace(/\/$/, "");
  const path = href.startsWith("/") ? href : `/${href}`;
  return `${base}${path}`;
}

function getPathname(href: string) {
  const path = href.startsWith("/") ? href : `/${href}`;
  return path.split(/[?#]/, 1)[0] ?? "/";
}

function resolveHref(props: NavLinkProps) {
  if (props.external) {
    return props.href;
  }

  if (props.microfrontend) {
    return joinUrl(clientEnv.VITE_LIGHTFAST_APP_URL, props.href);
  }

  if (props.href === "/") {
    return props.href;
  }

  if (isMigratedWwwStartPath(getPathname(props.href))) {
    return joinUrl(clientEnv.VITE_WWW_START_URL, props.href);
  }

  return joinUrl(clientEnv.VITE_LIGHTFAST_WWW_URL, props.href);
}

export function NavLink({
  // NavItem data fields — consumed here, not forwarded to the DOM
  title: _title,
  icon: _icon,
  label: _label,
  disabled: _disabled,
  prefetch: _prefetch,
  children,
  ...props
}: NavLinkProps) {
  const href = resolveHref(props);

  if (props.external) {
    const { external: _, microfrontend: __, ...anchorProps } = props;
    return (
      <a {...anchorProps} href={href}>
        {children}
      </a>
    );
  }

  if (props.microfrontend) {
    const { external: _, microfrontend: __, ...anchorProps } = props;
    return (
      <a {...anchorProps} href={href}>
        {children}
      </a>
    );
  }

  const { external: _, microfrontend: __, ...linkProps } = props;
  return (
    <a {...linkProps} href={href}>
      {children}
    </a>
  );
}
