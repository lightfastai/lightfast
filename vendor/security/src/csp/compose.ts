import type { Options } from "@nosecone/next";
import { defaults } from "@nosecone/next";
import type { Source } from "nosecone";
import type { CspDirectives, PartialCspDirectives } from "./types";

/**
 * Merge multiple CSP directive arrays into one, removing duplicates
 * Handles both static strings and dynamic nonce functions
 */
function mergeDirectives(...directiveArrays: any[]): Source[] {
  const merged = new Set<string>();
  const functions: any[] = [];

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
 * @param configs - Array of partial CSP directive configurations to merge
 * @returns Merged CSP directives with all sources combined and deduplicated
 *
 * @example
 * ```ts
 * const directives = composeCspDirectives(
 *   createClerkCspDirectives(),
 *   createAnalyticsCspDirectives(),
 *   createSentryCspDirectives()
 * );
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
      .filter((d) => d !== undefined);

    if (directives.length > 0) {
      result[key] = mergeDirectives(...directives);
    }
  }

  return result;
}

/**
 * Create Nosecone options with composed CSP directives
 *
 * Starts with Nosecone defaults and extends with provided CSP configurations
 *
 * @param configs - Array of partial CSP directive configurations to merge
 * @returns Nosecone options with merged CSP directives
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createClerkCspDirectives(),
 *   createAnalyticsCspDirectives(),
 *   createSentryCspDirectives()
 * );
 * const securityHeaders = securityMiddleware(options);
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

  const mergedDirectives: Record<string, any> = {};

  for (const key of directiveKeys) {
    const defaultValue = defaultDirectives[key];
    const userValue = userDirectives[key];

    if (defaultValue && userValue) {
      // Merge both
      mergedDirectives[key] = mergeDirectives(defaultValue, userValue);
    } else if (defaultValue) {
      // Keep default as-is (cast to array for consistency)
      mergedDirectives[key] = Array.from(defaultValue as any);
    } else if (userValue) {
      // Use user value
      mergedDirectives[key] = userValue;
    }
  }

  return {
    ...defaults,
    contentSecurityPolicy: {
      directives: mergedDirectives as any,
    },
  };
}
