"use client";

import { useCSSVariable } from "./use-css-variable";

/**
 * Hook specifically for reading timing-related CSS variables
 */

export function useCSSTimingVariable(
  variableName: string,
  defaultMs = 0,
): number {
  return useCSSVariable(variableName, "timeMs", defaultMs);
}
