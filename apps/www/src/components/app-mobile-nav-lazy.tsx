"use client";

import dynamic from "next/dynamic";

// Loaded client-side only — keeps Radix Sheet/Dialog out of the initial JS payload
export const AppMobileNavLazy = dynamic(
  () => import("./app-mobile-nav").then((m) => ({ default: m.AppMobileNav })),
  { ssr: false },
);
