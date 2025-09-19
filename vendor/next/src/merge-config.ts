import { NextConfig } from "next";

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

function isPlainObject(value: unknown): value is Record<string, any> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function mergeArrays<T>(a: T[] | undefined, b: T[] | undefined): T[] | undefined {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (!left.length && !right.length) return left;
  // De-duplicate only primitive arrays; object arrays are concatenated
  if ((left[0] !== undefined && isPrimitive(left[0])) || (right[0] !== undefined && isPrimitive(right[0]))) {
    const set = new Set<any>();
    for (const v of [...left, ...right]) set.add(v as any);
    return Array.from(set) as T[];
  }
  return [...left, ...right] as T[];
}

function deepMerge<T>(base: T, custom: any): T {
  if (custom === undefined) return base;

  // Arrays: concat (with primitive de-dup)
  if (Array.isArray(base) || Array.isArray(custom)) {
    return mergeArrays(base as any, custom as any) as any as T;
  }

  // Objects: recursive merge
  if (isPlainObject(base) && isPlainObject(custom)) {
    const result: Record<string, any> = { ...(base as any) };
    const keys = new Set<string>([...Object.keys(base as any), ...Object.keys(custom)]);
    for (const key of keys) {
      const bVal = (base as any)[key];
      const cVal = (custom as any)[key];
      if (Array.isArray(bVal) || Array.isArray(cVal)) {
        result[key] = mergeArrays(bVal, cVal);
      } else if (isPlainObject(bVal) || isPlainObject(cVal)) {
        result[key] = deepMerge(bVal ?? {}, cVal ?? {});
      } else {
        result[key] = cVal === undefined ? bVal : cVal;
      }
    }
    return result as T;
  }

  // Primitive/function: prefer custom when provided
  return (custom as T) ?? base;
}

async function resolveMaybeAsync<T>(value: T | (() => Promise<T>) | undefined): Promise<T | undefined> {
  if (!value) return undefined;
  if (typeof value === "function") return await (value as any)();
  return value as any;
}

/**
 * Deep merges Next.js configurations, ensuring all fields are merged.
 * - Objects are deep-merged
 * - Arrays are concatenated (primitive arrays de-duplicated)
 * - Functions are composed where appropriate (webpack/rewrites/redirects/headers)
 */
export function mergeNextConfig(
  baseConfig: NextConfig,
  customConfig: DeepPartial<NextConfig>,
): NextConfig {
  // First, deep-merge everything generically
  const merged = deepMerge(baseConfig as any, customConfig as any) as NextConfig;

  // Special handling for rewrites (array or object form)
  if (baseConfig.rewrites || customConfig.rewrites) {
    const baseRewrites = baseConfig.rewrites;
    const customRewrites = customConfig.rewrites;
    merged.rewrites = async () => {
      const base = await resolveMaybeAsync<any>(baseRewrites as any);
      const custom = await resolveMaybeAsync<any>(customRewrites as any);

      const b = base ?? [] as any;
      const c = custom ?? [] as any;

      // both arrays
      if (Array.isArray(b) && Array.isArray(c)) {
        return [...b, ...c];
      }
      // both objects with beforeFiles/afterFiles/fallback
      if (!Array.isArray(b) && !Array.isArray(c)) {
        return {
          beforeFiles: mergeArrays(b.beforeFiles || [], c.beforeFiles || []) || [],
          afterFiles: mergeArrays(b.afterFiles || [], c.afterFiles || []) || [],
          fallback: mergeArrays(b.fallback || [], c.fallback || []) || [],
        } as any;
      }
      // mixed: flatten to arrays
      const bArr = Array.isArray(b) ? b : [ ...(b.beforeFiles || []), ...(b.afterFiles || []), ...(b.fallback || []) ];
      const cArr = Array.isArray(c) ? c : [ ...(c.beforeFiles || []), ...(c.afterFiles || []), ...(c.fallback || []) ];
      return [...bArr, ...cArr];
    };
  }

  // redirects
  if (baseConfig.redirects || customConfig.redirects) {
    const baseRedirects = baseConfig.redirects;
    const customRedirects = customConfig.redirects;
    merged.redirects = async () => {
      const base = (await resolveMaybeAsync(baseRedirects as any)) || [];
      const custom = (await resolveMaybeAsync(customRedirects as any)) || [];
      return [...base, ...custom];
    };
  }

  // headers
  if (baseConfig.headers || customConfig.headers) {
    const baseHeaders = baseConfig.headers;
    const customHeaders = customConfig.headers;
    merged.headers = async () => {
      const base = (await resolveMaybeAsync(baseHeaders as any)) || [];
      const custom = (await resolveMaybeAsync(customHeaders as any)) || [];
      return [...base, ...custom];
    };
  }

  // webpack pipeline: run base then custom
  if (baseConfig.webpack || customConfig.webpack) {
    const baseWebpack = baseConfig.webpack;
    const customWebpack = customConfig.webpack as any;
    merged.webpack = (config, options) => {
      let result = config;
      if (typeof baseWebpack === "function") result = baseWebpack(result, options);
      if (typeof customWebpack === "function") result = customWebpack(result, options);
      return result;
    };
  }

  return merged;
}

export function createNextConfig(
  customConfig: DeepPartial<NextConfig>,
  baseConfig?: NextConfig,
): NextConfig {
  const vendorConfig = baseConfig || require("./next-config-builder").config;
  return mergeNextConfig(vendorConfig, customConfig);
}
