"use client";

import { useLandingCSSVariables, useScrollLock } from "./hooks";

// Client-side component that adds interactivity to the SSR-rendered page
export function ClientInteractivity() {
  // Initialize all client-side interactions and CSS variable management
  useLandingCSSVariables();

  // Prevent scrolling during initial loading animations
  useScrollLock();

  // This component renders nothing visible - it only provides interactivity
  return null;
}
