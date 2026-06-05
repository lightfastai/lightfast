import type { NavItem as BaseNavItem } from "@repo/ui/types/nav";

// Internal www route. During the Start migration, shared legacy components may
// link to aggregate routes now owned by apps/www-start.
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
  | InternalNavItem<string>
  | MicrofrontendNavItem
  | ExternalNavItem;

// ---------------------------------------------------------------------------
// defineNavItems()
// ---------------------------------------------------------------------------

interface LooseNavItem {
  href: string;
  title: string;
  [key: string]: unknown;
}

export function defineNavItems<const T extends readonly LooseNavItem[]>(
  items: T
): NavItem[] {
  return items as unknown as NavItem[];
}
