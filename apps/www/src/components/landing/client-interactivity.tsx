"use client";

import { useLandingCSSVariables } from "./hooks";

// Client-side component that adds interactivity to the SSR-rendered page
export function ClientInteractivity() {
  // Initialize all client-side interactions and CSS variable management
  useLandingCSSVariables();

  // This component renders nothing visible - it only provides interactivity
  return null;
}
