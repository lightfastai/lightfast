import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { DiscoveryOptions, PageEntry, PageProvider } from "./types";

/** Framework-level file patterns always skipped before reading HTML. */
export const DEFAULT_SKIP_FILE: RegExp[] = [
  /_not-found/,
  /_global-error/,
  /opengraph-image/,
  /twitter-image/,
];

/** Framework-level URL patterns always excluded from the output. */
export const DEFAULT_SKIP_URL: RegExp[] = [
  /\/llms/,
  /\/sitemap/,
  /\/robots/,
  /\/rss\.xml/,
  /\/atom\.xml/,
  /\/feed\.xml/,
  /\[/, // unresolved dynamic segments
];

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

function extractMeta(
  html: string,
  stripTitleSuffix?: string
): { title?: string; description?: string; canonical?: string } {
  const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  let title = rawTitle ? decodeHtmlEntities(rawTitle).trim() : undefined;
  if (title && stripTitleSuffix) {
    // String-based — avoids regex injection if suffix contains special chars (e.g. "lightfast.ai")
    const suffix = ` | ${stripTitleSuffix}`;
    const idx = title.lastIndexOf(suffix);
    if (idx !== -1) {
      title = title.slice(0, idx).trim();
    }
  }

  const rawDesc =
    html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+name="description"/i)?.[1];
  const description = rawDesc ? decodeHtmlEntities(rawDesc) : undefined;

  const canonical =
    html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ??
    html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)?.[1];

  return { title, description, canonical };
}

async function* walkBuildOutput(dir: string): AsyncGenerator<string> {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkBuildOutput(full);
    } else if (entry.name.endsWith(".html")) {
      yield full;
    }
  }
}

/** Discover and normalize static pages from the Next.js build output. */
export async function collectStaticPages(
  opts: DiscoveryOptions = {}
): Promise<PageEntry[]> {
  const {
    buildOutputDir = join(process.cwd(), ".next", "server", "app"),
    skipFile = [],
    skipUrl = [],
    stripTitleSuffix,
  } = opts;

  const skipFilePatterns = [...DEFAULT_SKIP_FILE, ...skipFile];
  const skipUrlPatterns = [...DEFAULT_SKIP_URL, ...skipUrl];

  const pages: PageEntry[] = [];

  for await (const filePath of walkBuildOutput(buildOutputDir)) {
    const rel = relative(buildOutputDir, filePath);
    if (skipFilePatterns.some((p) => p.test(rel))) {
      continue;
    }

    try {
      const html = await readFile(filePath, "utf8");
      const { title, description, canonical } = extractMeta(
        html,
        stripTitleSuffix
      );
      if (!(canonical && title)) {
        continue;
      }
      if (skipUrlPatterns.some((p) => p.test(canonical))) {
        continue;
      }
      pages.push({
        url: canonical,
        title,
        description: description ?? undefined,
      });
    } catch {
      // skip unreadable files
    }
  }

  return pages;
}

/** Merge results from multiple dynamic providers. */
export async function collectDynamicPages(
  providers: PageProvider[]
): Promise<PageEntry[]> {
  const results = await Promise.all(providers.map((p) => p().catch(() => [])));
  return results.flat();
}

/**
 * Collect all pages: static discovery + dynamic providers combined.
 * Deduplicates by URL — provider entries override static discovery entries
 * for the same URL (last-writer wins in provider order).
 */
export async function collectAllPages(
  providers: PageProvider[] = [],
  opts: DiscoveryOptions = {}
): Promise<PageEntry[]> {
  const [staticPages, dynamicPages] = await Promise.all([
    collectStaticPages(opts),
    collectDynamicPages(providers),
  ]);

  // Deduplicate: static first, then providers override by URL
  const byUrl = new Map<string, PageEntry>();
  for (const page of staticPages) {
    byUrl.set(page.url, page);
  }
  for (const page of dynamicPages) {
    byUrl.set(page.url, page);
  }

  return [...byUrl.values()];
}
