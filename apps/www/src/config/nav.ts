/**
 * App navigation configuration
 *
 * Exposes nav groups using defineNavItems() for compile-time route validation:
 * - INTERNAL_NAV: links within the app/site
 * - SOCIAL_NAV: external/social links with optional icons
 */
import { defineNavItems } from "~/types/nav";

export const INTERNAL_NAV = defineNavItems([
  { title: "Pricing", href: "/pricing" },
  { title: "Integrations", href: "/integrations" },
  { title: "Early Access", href: "/early-access", microfrontend: true },
  { title: "Docs", href: "/docs/get-started/overview" },
]);

export const SOCIAL_NAV = defineNavItems([
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
]);

// Resources sub-navigation used for the marketing header dropdown
export const RESOURCES_NAV = defineNavItems([
  { title: "Changelog", href: "/changelog" },
  { title: "Blog", href: "/blog" },
]);

// Navigation for the pitch-deck pages
export const PITCH_DECK_NAV = defineNavItems([
  { title: "Home", href: "/" },
  { title: "Pricing", href: "/pricing" },
  { title: "Blog", href: "/blog" },
  { title: "Changelog", href: "/changelog" },
  { title: "Docs", href: "/docs/get-started/overview" },
  { title: "Contact", href: "mailto:jp@lightfast.ai", external: true },
]);
