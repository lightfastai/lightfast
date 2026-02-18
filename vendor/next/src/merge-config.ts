import type { NextConfig } from "next";

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

interface Rewrite {
  source: string;
  destination: string;
  basePath?: false;
  locale?: false;
}

interface Header {
  source: string;
  basePath?: false;
  locale?: false;
  headers: { key: string; value: string }[];
}

interface RedirectBase {
  source: string;
  destination: string;
  basePath?: false;
  locale?: false;
}

type Redirect = RedirectBase &
  (
    | { statusCode?: never; permanent: boolean }
    | { statusCode: number; permanent?: never }
  );

interface RewritesObject {
  beforeFiles?: Rewrite[];
  afterFiles?: Rewrite[];
  fallback?: Rewrite[];
}

type RewritesResult = Rewrite[] | RewritesObject;

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isPrimitive(
  value: unknown,
): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function mergeArrays<T>(
  a: T[] | undefined,
  b: T[] | undefined,
): T[] | undefined {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (!left.length && !right.length) return left;
  // De-duplicate only primitive arrays; object arrays are concatenated
  if (
    (left[0] !== undefined && isPrimitive(left[0])) ||
    (right[0] !== undefined && isPrimitive(right[0]))
  ) {
    const set = new Set<T>();
    for (const v of [...left, ...right]) set.add(v);
    return Array.from(set);
  }
  return [...left, ...right];
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  custom: Record<string, unknown> | undefined,
): T {
  if (custom === undefined) return base;

  // Arrays: concat (with primitive de-dup)
  if (Array.isArray(base) || Array.isArray(custom)) {
    return mergeArrays(
      base as unknown as unknown[],
      custom as unknown as unknown[],
    ) as unknown as T;
  }

  // Objects: recursive merge
  if (isPlainObject(base) && isPlainObject(custom)) {
    const result: Record<string, unknown> = { ...base };
    const keys = new Set<string>([
      ...Object.keys(base),
      ...Object.keys(custom),
    ]);
    for (const key of keys) {
      const bVal = base[key];
      const cVal = custom[key];
      if (Array.isArray(bVal) || Array.isArray(cVal)) {
        result[key] = mergeArrays(
          bVal as unknown[] | undefined,
          cVal as unknown[] | undefined,
        );
      } else if (isPlainObject(bVal) || isPlainObject(cVal)) {
        result[key] = deepMerge(
          (bVal ?? {}) as Record<string, unknown>,
          (cVal ?? {}) as Record<string, unknown>,
        );
      } else {
        result[key] = cVal === undefined ? bVal : cVal;
      }
    }
    return result as T;
  }

  // Primitive/function: prefer custom when provided
  return custom as unknown as T;
}

async function resolveMaybeAsync<T>(
  value: T | (() => Promise<T>) | undefined,
): Promise<T | undefined> {
  if (!value) return undefined;
  if (typeof value === "function") {
    return await (value as () => Promise<T>)();
  }
  return value;
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
  const merged = deepMerge(
    baseConfig as Record<string, unknown>,
    customConfig as Record<string, unknown>,
  ) as unknown as NextConfig;

  // Special handling for rewrites (array or object form)
  if (baseConfig.rewrites ?? customConfig.rewrites) {
    const baseRewrites = baseConfig.rewrites;
    const customRewrites = customConfig.rewrites;
    merged.rewrites = async () => {
      const base = await resolveMaybeAsync<RewritesResult>(
        baseRewrites as RewritesResult | (() => Promise<RewritesResult>) | undefined,
      );
      const custom = await resolveMaybeAsync<RewritesResult>(
        customRewrites as RewritesResult | (() => Promise<RewritesResult>) | undefined,
      );

      const b = base ?? [];
      const c = custom ?? [];

      // both arrays
      if (Array.isArray(b) && Array.isArray(c)) {
        return [...b, ...c];
      }
      // both objects with beforeFiles/afterFiles/fallback
      if (!Array.isArray(b) && !Array.isArray(c)) {
        return {
          beforeFiles:
            mergeArrays(b.beforeFiles ?? [], c.beforeFiles ?? []) ?? [],
          afterFiles:
            mergeArrays(b.afterFiles ?? [], c.afterFiles ?? []) ?? [],
          fallback:
            mergeArrays(b.fallback ?? [], c.fallback ?? []) ?? [],
        };
      }
      // mixed: flatten to arrays
      const bArr = Array.isArray(b)
        ? b
        : [
            ...(b.beforeFiles ?? []),
            ...(b.afterFiles ?? []),
            ...(b.fallback ?? []),
          ];
      const cArr = Array.isArray(c)
        ? c
        : [
            ...(c.beforeFiles ?? []),
            ...(c.afterFiles ?? []),
            ...(c.fallback ?? []),
          ];
      return [...bArr, ...cArr];
    };
  }

  // redirects
  if (baseConfig.redirects ?? customConfig.redirects) {
    const baseRedirects = baseConfig.redirects;
    const customRedirects = customConfig.redirects;
    merged.redirects = async () => {
      const base =
        (await resolveMaybeAsync<Redirect[]>(
          baseRedirects as Redirect[] | (() => Promise<Redirect[]>) | undefined,
        )) ?? [];
      const custom =
        (await resolveMaybeAsync<Redirect[]>(
          customRedirects as Redirect[] | (() => Promise<Redirect[]>) | undefined,
        )) ?? [];
      return [...base, ...custom];
    };
  }

  // headers
  if (baseConfig.headers ?? customConfig.headers) {
    const baseHeaders = baseConfig.headers;
    const customHeaders = customConfig.headers;
    merged.headers = async () => {
      const base =
        (await resolveMaybeAsync<Header[]>(
          baseHeaders as Header[] | (() => Promise<Header[]>) | undefined,
        )) ?? [];
      const custom =
        (await resolveMaybeAsync<Header[]>(
          customHeaders as Header[] | (() => Promise<Header[]>) | undefined,
        )) ?? [];
      return [...base, ...custom];
    };
  }

  // webpack pipeline: run base then custom
  if (baseConfig.webpack ?? customConfig.webpack) {
    const baseWebpack = baseConfig.webpack;
    const customWebpack = customConfig.webpack;
    merged.webpack = (config: unknown, options) => {
      let result: unknown = config;
      if (typeof baseWebpack === "function")
        result = baseWebpack(result, options) as unknown;
      if (typeof customWebpack === "function")
        result = (customWebpack as NonNullable<NextConfig["webpack"]>)(
          result,
          options,
        ) as unknown;
      return result;
    };
  }

  return merged;
}

export async function createNextConfig(
  customConfig: DeepPartial<NextConfig>,
  baseConfig?: NextConfig,
): Promise<NextConfig> {
  const vendorConfig =
    baseConfig ??
    ((await import("./next-config-builder")) as { config: NextConfig }).config;
  return mergeNextConfig(vendorConfig, customConfig);
}
