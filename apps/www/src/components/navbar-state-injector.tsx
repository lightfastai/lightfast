"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

interface NavbarStateInjectorProps {
  initialPathname: string;
}

/**
 * Lightweight client component that ONLY manages state
 * No UI rendering - just injects dynamic classes into the DOM
 */
export function NavbarStateInjector({ initialPathname }: NavbarStateInjectorProps) {
  const pathname = usePathname();

  // Handle scroll detection and DOM manipulation
  useEffect(() => {
    const navbarElement = document.getElementById("app-navbar");
    if (!navbarElement) return;

    const updateNavbarState = () => {
      const scrollY = window.scrollY;
      const isScrolled = scrollY > 25;
      const isHomePage = pathname === "/";
      const showBrandNavbar = isHomePage || isScrolled;

      if (showBrandNavbar) {
        navbarElement.classList.add("brand-navbar");
        navbarElement.classList.add("group-has-[.nav-trigger:hover]:dark");
        navbarElement.classList.add("group-has-[.nav-trigger[data-state=open]]:dark");

        // Show background elements
        const bgElements = navbarElement.querySelectorAll("[data-navbar-bg]");
        bgElements.forEach(el => {
          (el as HTMLElement).style.display = "block";
        });
      } else {
        navbarElement.classList.remove("brand-navbar");
        navbarElement.classList.remove("group-has-[.nav-trigger:hover]:dark");
        navbarElement.classList.remove("group-has-[.nav-trigger[data-state=open]]:dark");

        // Hide background elements
        const bgElements = navbarElement.querySelectorAll("[data-navbar-bg]");
        bgElements.forEach(el => {
          (el as HTMLElement).style.display = "none";
        });
      }
    };

    // Check initial state
    updateNavbarState();

    // Add scroll listener
    window.addEventListener("scroll", updateNavbarState, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener("scroll", updateNavbarState);
    };
  }, [pathname]);

  // This component doesn't render anything
  return null;
}
