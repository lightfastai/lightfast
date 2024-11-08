import type { Icons } from "~/app/icons";

export interface NavItem {
  title: string;
  href?: string;
  disabled?: boolean;
  external?: boolean;
  icon?: keyof typeof Icons;
  label?: string;
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface MainNavItem extends NavItem {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DocsNavItem extends NavItemWithChildren {}
