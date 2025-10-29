import type { NavItem as BaseNavItem } from "@repo/ui/types/nav";

// App-specific extension of shared NavItem to support microfrontends
export interface NavItem extends BaseNavItem {
  // When true, render links using @vercel/microfrontends Link
  microfrontend?: boolean;
}

export type { NavItemWithChildren, NavItemRecord } from "@repo/ui/types/nav";

