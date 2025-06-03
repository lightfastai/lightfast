"use client";

import type { CSSConverter } from "./use-css-variable";
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
/**
 * Hook for reading multiple CSS variables at once
 */

export function useCSSVariables<T extends Record<string, unknown>>(variables: {
  [K in keyof T]: {
    name: string;
    converter?: CSSConverter;
    defaultValue?: T[K];
  };
}): T {
  const result = {} as T;

  for (const [key, config] of Object.entries(variables)) {
    const typedConfig = config as {
      name: string;
      converter?: CSSConverter;
      defaultValue?: T[keyof T];
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    result[key as keyof T] = useCSSVariable(
      typedConfig.name,
      typedConfig.converter ?? "string",
      typedConfig.defaultValue,
    );
  }

  return result;
}
