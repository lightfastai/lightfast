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
 * IMPORTANT: User directives REPLACE Nosecone defaults (not merge).
 *
 * This is intentional - when you provide scriptSrc, it replaces the default
 * nonce-based scriptSrc entirely. This is necessary because:
 * 1. CSP spec: nonces take precedence over 'unsafe-inline' in modern browsers
 * 2. Vercel Analytics needs 'unsafe-inline' WITHOUT nonces to work
 * 3. Matches next-forge's proven pattern
 *
 * @param configs - Array of partial CSP directive configurations to merge together
 * @returns Nosecone options with user directives replacing defaults
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createNextjsCspDirectives(),    // REPLACES scriptSrc: ['self', 'unsafe-inline']
 *   createClerkCspDirectives(),      // ADDS to scriptSrc: [clerk, cloudflare]
 *   createAnalyticsCspDirectives()   // ADDS to scriptSrc: [vercel-analytics]
 * );
 * // Final scriptSrc: ['self', 'unsafe-inline', clerk, cloudflare, vercel-analytics]
 * // (NO nonce - replaced by our configs)
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

  // Extend each default directive with user directives
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

    if (userValue) {
      // User provided value - use it and REPLACE defaults (don't merge)
      // This is critical for scriptSrc where we need 'unsafe-inline' WITHOUT nonces
      mergedDirectives[key] = userValue;
    } else if (defaultValue) {
      // No user value - keep default as-is
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
