import type { NavItem as BaseNavItem } from "@repo/ui/types/nav";
import type { Route } from "next";

// Internal www route — href is a typed Route
type InternalNavItem<H extends string = string> = BaseNavItem<H> & {
  external?: false;
  microfrontend?: false;
};

// Cross-zone link — href is an untyped string (different zone, not in this app's router)
type MicrofrontendNavItem = BaseNavItem<string> & {
  external?: false;
  microfrontend: true;
};

// External link — href is an untyped string (mailto:, https://, etc.)
type ExternalNavItem = BaseNavItem<string> & {
  external: true;
  microfrontend?: false;
};

export type NavItem =
  | InternalNavItem<Route>
  | MicrofrontendNavItem
  | ExternalNavItem;

// ---------------------------------------------------------------------------
// defineNavItems() — validates Route<H> per literal at the definition site
// ---------------------------------------------------------------------------

/**
 * Validates each nav item at compile time:
 * - Items with `microfrontend: true` or `external: true` skip route validation
 * - Internal items must have an href that satisfies Route<H> (literal inference)
 *
 * If the href is not a valid apps/www route, the item is intersected with a
 * readonly error brand that surfaces a clear diagnostic message at the call site.
 */
type ValidateNavItem<T> = T extends { microfrontend: true } | { external: true }
  ? T
  : T extends { href: infer H extends string }
    ? H extends Route<H>
      ? T
      : T & {
          readonly __invalid_route__: `"${H}" is not a valid apps/www route. Use microfrontend: true for cross-app paths.`;
        }
    : T;

interface LooseNavItem {
  href: string;
  title: string;
  [key: string]: unknown;
}

export function defineNavItems<const T extends readonly LooseNavItem[]>(
  items: { [K in keyof T]: ValidateNavItem<T[K]> }
): NavItem[] {
  return items as unknown as NavItem[];
}
