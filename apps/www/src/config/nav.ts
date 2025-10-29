/**
 * App navigation configuration
 *
 * Exposes two nav groups using the shared UI NavItem type:
 * - INTERNAL_NAV: links within the app/site
 * - SOCIAL_NAV: external/social links with optional icons
 */
import type { NavItem } from "~/types/nav";

export const INTERNAL_NAV: NavItem[] = [
  { title: "Features", href: "/features" },
  { title: "Pricing", href: "/pricing" },
  // Docs is served from the docs microfrontend
  { title: "Docs", href: "/docs/get-started/overview", microfrontend: true },
  { title: "Early Access", href: "/early-access" },
];

export const SOCIAL_NAV: NavItem[] = [
  {
    title: "X",
    label: "X",
    href: "https://x.com/lightfastai",
    icon: "twitter",
    external: true,
  },
  {
    title: "GitHub",
    label: "GitHub",
    href: "https://github.com/lightfastai",
    icon: "gitHub",
    external: true,
  },
  {
    title: "Discord",
    label: "Discord",
    href: "#discord",
    icon: "discord",
    external: true,
  },
];

export const LEGAL_NAV: NavItem[] = [
  { title: "Terms", href: "/legal/terms" },
  { title: "Privacy", href: "/legal/privacy" },
];

// Feature sub-navigation used for the marketing header dropdown
export const FEATURES_NAV: NavItem[] = [
  { title: "Neural Memory", href: "/features/memory" },
  { title: "Timeline", href: "/features/timeline" },
  { title: "For Agents", href: "/features/agents" },
];

// Resources sub-navigation used for the marketing header dropdown
export const RESOURCES_NAV: NavItem[] = [
  //  { title: "Changelog", href: "/changelog" },
  { title: "Docs", href: "/docs/get-started/overview", microfrontend: true },
  // { title: "Blog", href: "/blog" },
];
