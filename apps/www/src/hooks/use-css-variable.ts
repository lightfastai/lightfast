"use client";

import { useEffect, useState } from "react";

/**
 * Convert CSS time value to milliseconds
 */
function cssTimeToMs(cssValue: string): number {
  if (!cssValue || cssValue === "initial" || cssValue === "inherit") {
    return 0;
  }

  const numValue = parseFloat(cssValue);
  if (isNaN(numValue)) {
    return 0;
  }

  return cssValue.includes("ms") ? numValue : numValue * 1000;
}

/**
 * Convert CSS number value to number
 */
function cssToNumber(cssValue: string): number {
  const numValue = parseFloat(cssValue);
  return isNaN(numValue) ? 0 : numValue;
}

/**
 * Available CSS value converters
 */
export const cssConverters = {
  string: (value: string) => value,
  number: cssToNumber,
  timeMs: cssTimeToMs,
} as const;

export type CSSConverter = keyof typeof cssConverters;

/**
 * Hook to read CSS custom properties with automatic conversion
 */
export function useCSSVariable<T = string>(
  variableName: string,
  converter: CSSConverter = "string" as const,
  defaultValue?: T,
): T {
  const [value, setValue] = useState<T>(() => {
    // Return default during SSR
    if (typeof window === "undefined") {
      return defaultValue as T;
    }

    try {
      const computedValue = getComputedStyle(document.documentElement)
        .getPropertyValue(variableName)
        .trim();

      if (!computedValue) {
        return defaultValue as T;
      }

      return cssConverters[converter](computedValue) as T;
    } catch {
      return defaultValue as T;
    }
  });

  useEffect(() => {
    // Skip during SSR
    if (typeof window === "undefined") {
      return;
    }

    const updateValue = () => {
      try {
        const computedValue = getComputedStyle(document.documentElement)
          .getPropertyValue(variableName)
          .trim();

        if (computedValue) {
          const convertedValue = cssConverters[converter](computedValue) as T;
          setValue(convertedValue);
        }
      } catch (error) {
        console.warn(`Failed to read CSS variable ${variableName}:`, error);
      }
    };

    // Initial read
    updateValue();

    // Optional: Listen for changes if CSS variables can change at runtime
    // For now, we'll just read once on mount since our timing values are static
  }, [variableName, converter]);

  return value;
}
