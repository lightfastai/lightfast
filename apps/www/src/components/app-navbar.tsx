import { headers } from "next/headers";
import Link from "~/components/ui/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import { INTERNAL_NAV, RESOURCES_NAV } from "~/config/nav";
import { NavbarStateInjector } from "./navbar-state-injector";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@repo/ui/components/ui/navigation-menu";

interface AppNavbarProps {
  pathname?: string;
}

/**
 * Server-rendered navbar component with minimal client-side behavior injection
 *
 * ## Architecture Pattern: SSR with Dynamic Behavior Injection
 *
 * This component demonstrates an optimal pattern for SSR with client-side interactivity:
 *
 * ### Flow:
 * 1. **Middleware** (middleware.ts)
 *    - Runs on Edge before any rendering (~0-5ms)
 *    - Sets x-pathname header from request URL
 *    - Enables server component to know the current route
 *
 * 2. **Server Component** (this file)
 *    - Reads pathname from middleware headers
 *    - Renders ALL HTML on server with correct initial state
 *    - Sets initial classes based on pathname (e.g., homepage = brand navbar)
 *    - Zero layout shift on initial load
 *
 * 3. **Client Injector** (navbar-state-injector.tsx)
 *    - Lightweight component (~2KB) with zero UI rendering
 *    - Uses usePathname() for client-side navigation updates
 *    - Listens to scroll events for dynamic behavior
 *    - Directly manipulates DOM (getElementById + classList)
 *    - Updates display styles based on scroll position
 *
 * ### Why This Pattern?
 *
 * **Performance:**
 * - Server renders complete HTML (~50ms) with correct initial state
 * - Client only injects behavior, no HTML re-rendering
 * - Eliminates layout shift and flash of incorrect content
 * - Better Core Web Vitals (CLS = 0)
 *
 * **SEO:**
 * - Search engines see fully-rendered navbar
 * - Correct classes and structure from server
 * - Progressive enhancement (works without JS)
 *
 * **Bundle Size:**
 * - No state management library (no Zustand, Jotai, etc.)
 * - No duplicate HTML in JavaScript bundle
 * - Only ~2KB for behavior injection
 *
 * ### Key Techniques:
 *
 * 1. **Middleware + Headers Pattern**
 *    ```
 *    Middleware → Sets x-pathname → Server reads headers() → Correct SSR
 *    ```
 *    This is dependency injection at the HTTP level - elegant and fast.
 *
 * 2. **Behavior Injection Pattern**
 *    ```
 *    Server: Renders <header id="app-navbar">...</header>
 *    Client: document.getElementById("app-navbar").classList.add(...)
 *    ```
 *    No React re-renders, just direct DOM manipulation.
 *
 * 3. **Hybrid State Management**
 *    - Middleware for initial SSR accuracy
 *    - usePathname() for client navigation updates
 *    - Best of both worlds
 *
 * ### Trade-offs:
 *
 * ✅ Pros:
 * - True SSR with zero layout shift
 * - Minimal client JavaScript
 * - Fast time-to-interactive
 * - SEO-friendly
 *
 * ! Cons:
 * - Requires middleware setup
 * - Direct DOM manipulation (less "React-like")
 * - Client component can't use React state for UI
 *
 * ### Alternative Approaches (Not Used):
 *
 * ❌ Full Client Component:
 *    - Would send ~50KB+ of HTML in JS bundle
 *    - Layout shift during hydration
 *    - Worse SEO
 *
 * ❌ No Middleware:
 *    - Server wouldn't know pathname
 *    - Generic initial state → flash on homepage
 *    - Bad UX
 *
 * ❌ State Management Library:
 *    - Unnecessary overhead (~10-20KB)
 *    - More complex than needed
 *    - Still requires client-side updates
 *
 * @see navbar-state-injector.tsx - Client behavior injection
 * @see middleware.ts - Pathname header injection
 */
export async function AppNavbar({
  pathname: propPathname,
}: AppNavbarProps = {}) {
  // Get pathname from headers (set by middleware)
  // Falls back to "/" if header is missing (shouldn't happen in practice)
  const headersList = await headers();
  const pathname = propPathname || headersList.get("x-pathname") || "/";

  // Calculate initial state for SSR
  // This determines what the user sees immediately on page load
  const isHomePage = pathname === "/";
  const showBrandNavbar = isHomePage; // On server, only show brand navbar on home page
  // Note: Client will also consider scroll position, but server can't know that

  return (
    <>
      {/*
        Lightweight client component that only manages dynamic behavior.
        - NO HTML rendering
        - Only DOM manipulation via getElementById
        - Handles scroll detection and pathname changes
        - ~2KB bundle size
      */}
      <NavbarStateInjector initialPathname={pathname} />

      {/*
        All HTML is server-rendered below.
        This ensures:
        1. Search engines see complete content
        2. Users see correct initial state
        3. No layout shift on hydration
        4. Works without JavaScript (progressive enhancement)
      */}
      <header
        id="app-navbar" // ID used by client injector for DOM manipulation
        className={`group ${showBrandNavbar ? "brand-navbar group-has-[.nav-trigger:hover]:dark group-has-[.nav-trigger[data-state=open]]:dark" : ""} shrink-0 sticky top-0 z-50 py-4 page-gutter bg-background transition-colors duration-300`}
      >
        {/*
          Brand blue background - shown on home page or when scrolled
          Server sets initial display based on pathname
          Client updates based on scroll position
        */}
        <div
          data-navbar-bg="blue" // Marker for client injector to find this element
          className="absolute inset-0 bg-[var(--brand-blue)] transition-opacity duration-300"
          style={{ display: showBrandNavbar ? "block" : "none" }}
          aria-hidden="true"
        />

        {/*
          Dark background that slides down on hover and when menu is open
          Uses CSS transitions for smooth animation
        */}
        <div
          data-navbar-bg="dark" // Marker for client injector to find this element
          className="absolute inset-0 bg-black -translate-y-full group-has-[.nav-trigger:hover]:translate-y-0 group-has-[.nav-trigger[data-state=open]]:translate-y-0 transition-transform duration-300 ease-out"
          style={{ display: showBrandNavbar ? "block" : "none" }}
          aria-hidden="true"
        />

        <div className="relative flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
          {/* Left: Logo */}
          <div className="-ml-2 flex items-center md:justify-self-start">
            <Button variant="none" size="lg" className="group" asChild>
              <Link href="/">
                <Icons.logo className="size-22 text-foreground transition-colors" />
              </Link>
            </Button>
          </div>

          {/* Center: Nav items */}
          <nav className="hidden md:flex items-center md:justify-self-center">
            {/*
              Resources dropdown
              Uses Radix UI NavigationMenu primitives
              These components are server-rendered but include client-side
              interactivity for dropdown behavior (handled by Radix)
            */}
            <NavigationMenu viewport={false}>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="nav-trigger text-foreground">
                    Resources
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px]">
                      {RESOURCES_NAV.map((item) => (
                        <NavigationMenuLink asChild key={item.href}>
                          <Link
                            href={item.href}
                            microfrontend={item.microfrontend}
                            className="text-popover-foreground"
                          >
                            {item.title}
                          </Link>
                        </NavigationMenuLink>
                      ))}
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            {/* Remaining top-level nav items (Pricing, Early Access, Docs) */}
            {INTERNAL_NAV.filter((i) => i.href !== "/features").map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className="nav-trigger text-foreground"
                asChild
              >
                <Link href={item.href} microfrontend={item.microfrontend}>
                  {item.title}
                </Link>
              </Button>
            ))}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-4 md:justify-self-end">
            {/* Search Icon */}
            <Button variant="link" size="lg" asChild>
              <Link href="/search" microfrontend aria-label="Search">
                <Search className="h-5 w-5" />
              </Link>
            </Button>

            {/* Sign In Button */}
            <Button
              variant="secondary"
              size="lg"
              className="rounded-full"
              asChild
            >
              <Link href="/sign-in" microfrontend>
                <span className="text-sm text-secondary-foreground font-medium">
                  Log In
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </header>
    </>
  );
}

