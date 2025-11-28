import type { Options } from "@nosecone/next";
import { defaults } from "@nosecone/next";
import type { Source } from "nosecone";
import type { CspDirective, CspDirectives, PartialCspDirectives } from "./types";

/**
 * Merge multiple CSP directive arrays into one, removing duplicates
 * Handles both static strings and dynamic nonce functions
 */
function mergeDirectives(...directiveArrays: readonly Source[][]): Source[] {
  const merged = new Set<string>();
  const functions: (() => string)[] = [];

  for (const directives of directiveArrays) {
    if (!directives) continue;

    for (const directive of directives) {
      if (typeof directive === "function") {
        functions.push(directive);
      } else {
        merged.add(directive);
      }
    }
  }

  return [...Array.from(merged), ...functions] as Source[];
}

/**
 * Compose multiple partial CSP directive configurations into a single configuration
 *
 * Merges all provided configs together, combining their directive arrays.
 *
 * @param configs - Array of partial CSP directive configurations to merge
 * @returns Merged CSP directives with all sources combined and deduplicated
 *
 * @example
 * ```ts
 * const directives = composeCspDirectives(
 *   createNextjsCspDirectives(),  // scriptSrc: ['self', 'unsafe-inline']
 *   createClerkCspDirectives(),    // scriptSrc: [clerk, cloudflare]
 *   createAnalyticsCspDirectives() // scriptSrc: [vercel-analytics]
 * );
 * // Result: scriptSrc: ['self', 'unsafe-inline', clerk, cloudflare, vercel-analytics]
 * ```
 */
export function composeCspDirectives(
  ...configs: PartialCspDirectives[]
): CspDirectives {
  const result: CspDirectives = {};

  // Merge each directive type
  const directiveKeys: (keyof CspDirectives)[] = [
    "baseUri",
    "childSrc",
    "connectSrc",
    "defaultSrc",
    "fontSrc",
    "formAction",
    "frameAncestors",
    "frameSrc",
    "imgSrc",
    "manifestSrc",
    "mediaSrc",
    "objectSrc",
    "scriptSrc",
    "styleSrc",
    "workerSrc",
  ];

  for (const key of directiveKeys) {
    const directives = configs
      .map((config) => config[key])
      .filter((d): d is CspDirective => d !== undefined);

    if (directives.length > 0) {
      result[key] = mergeDirectives(...directives);
    }
  }

  return result;
}

/**
 * Create Nosecone options with composed CSP directives
 *
 * IMPORTANT: User directives MERGE with Nosecone defaults (following next-forge pattern).
 *
 * This follows the next-forge approach: spread defaults and extend with user values.
 * We merge user-provided sources with default sources for each directive.
 *
 * @param configs - Array of partial CSP directive configurations to merge together
 * @returns Nosecone options with user directives merged with defaults
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createNextjsCspDirectives(),    // ADDS: ['self', 'unsafe-inline']
 *   createClerkCspDirectives(),      // ADDS: [clerk, cloudflare]
 *   createAnalyticsCspDirectives()   // ADDS: [vercel-analytics]
 * );
 * // Final scriptSrc: [...defaults, 'self', 'unsafe-inline', clerk, cloudflare, vercel-analytics]
 * ```
 */
export function composeCspOptions(
  ...configs: PartialCspDirectives[]
): Options {
  const defaultDirectives = defaults.contentSecurityPolicy?.directives;

  if (!defaultDirectives) {
    throw new Error("Nosecone defaults do not include CSP directives");
  }

  // Merge user configs together
  const userDirectives = composeCspDirectives(...configs);

  // Extend each default directive with user directives (merge, don't replace)
  const directiveKeys: (keyof CspDirectives)[] = [
    "baseUri",
    "childSrc",
    "connectSrc",
    "defaultSrc",
    "fontSrc",
    "formAction",
    "frameAncestors",
    "frameSrc",
    "imgSrc",
    "manifestSrc",
    "mediaSrc",
    "objectSrc",
    "scriptSrc",
    "styleSrc",
    "workerSrc",
  ];

  const mergedDirectives: Record<string, Source[]> = {};

  for (const key of directiveKeys) {
    const defaultValue = defaultDirectives[key];
    const userValue = userDirectives[key];

    if (userValue && defaultValue) {
      // Merge user values with defaults (next-forge pattern)
      // Convert readonly array to mutable array
      mergedDirectives[key] = mergeDirectives([...defaultValue] as Source[], userValue);
    } else if (userValue) {
      // Only user value - use it
      mergedDirectives[key] = userValue;
    } else if (defaultValue) {
      // Only default value - keep it
      mergedDirectives[key] = [...defaultValue] as Source[];
    }
  }

  return {
    ...defaults,
    contentSecurityPolicy: {
      directives: mergedDirectives,
    },
  };
}
