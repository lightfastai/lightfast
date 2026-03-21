/**
 * Generates llms.txt by reading the compiled Next.js build output at request time,
 * supplemented with CMS data for dynamically-rendered pages.
 *
 * Static pages are discovered automatically from .next/server/app/ HTML files —
 * no manifest or hardcoded list required. Dynamic pages (blog, changelog, legal)
 * come from @vendor/cms, the same source as sitemap.ts.
 *
 * Falls back gracefully when the build output is absent (e.g. `next dev`).
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { blog, changelog, legal } from "@vendor/cms";

export const revalidate = false;

const BASE_URL = "https://lightfast.ai";
const NEXT_APP_DIR = join(process.cwd(), ".next", "server", "app");

/** File-level patterns that skip before reading HTML */
const SKIP_FILE = [
  /_not-found/,
  /_global-error/,
  /opengraph-image/,
  /twitter-image/,
];

/** URL patterns excluded from the output */
const SKIP_URL = [
  /\/search(\b|\/)/,
  /\/pitch-deck/,
  /\/llms/,
  /\/sitemap/,
  /\/robots/,
  /\/rss\.xml/,
  /\/atom\.xml/,
  /\/feed\.xml/,
  /\[/, // un-resolved dynamic segments
];

interface PageEntry {
  description: string;
  title: string;
  url: string;
}

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

function extractMeta(html: string): {
  title?: string;
  description?: string;
  canonical?: string;
} {
  const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const title = rawTitle
    ? decodeHtmlEntities(rawTitle)
        .replace(/\s*\|\s*Lightfast\s*$/, "")
        .trim()
    : undefined;

  const rawDesc =
    html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta\s+content="([^"]+)"\s+name="description"/i)?.[1];
  const description = rawDesc ? decodeHtmlEntities(rawDesc) : undefined;

  const canonical =
    html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ??
    html.match(/<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i)?.[1];

  return { title, description, canonical };
}

async function* walkHtml(dir: string): AsyncGenerator<string> {
  if (!existsSync(dir)) {
    return;
  }
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkHtml(full);
    } else if (entry.name.endsWith(".html")) {
      yield full;
    }
  }
}

function sectionOf(url: string): string {
  if (url === BASE_URL || /\/(pricing|blog|changelog)($|\/)/.test(url)) {
    return "Marketing";
  }
  if (url.includes("/use-cases/")) {
    return "Use Cases";
  }
  if (url.includes("/docs/api-reference")) {
    return "API Reference";
  }
  if (url.includes("/docs")) {
    return "Docs";
  }
  if (url.includes("/legal/")) {
    return "Legal";
  }
  return "Marketing";
}

async function collectStaticPages(): Promise<PageEntry[]> {
  const pages: PageEntry[] = [];

  for await (const filePath of walkHtml(NEXT_APP_DIR)) {
    const rel = relative(NEXT_APP_DIR, filePath);
    if (SKIP_FILE.some((p) => p.test(rel))) {
      continue;
    }

    try {
      const html = await readFile(filePath, "utf8");
      const { title, description, canonical } = extractMeta(html);
      if (!(canonical && title)) {
        continue;
      }
      if (SKIP_URL.some((p) => p.test(canonical))) {
        continue;
      }
      pages.push({ url: canonical, title, description: description ?? "" });
    } catch {
      // skip unreadable files
    }
  }

  return pages;
}

async function collectCmsPages(): Promise<PageEntry[]> {
  const [blogPosts, changelogEntries, legalPages] = await Promise.all([
    blog.getPosts().catch(() => []),
    changelog.getEntries().catch(() => []),
    legal.getPosts().catch(() => []),
  ]);

  const pages: PageEntry[] = [];

  // Blog listing page
  pages.push({
    url: `${BASE_URL}/blog`,
    title: "Blog",
    description:
      "Insights, guides, and product updates from the Lightfast team.",
  });

  // Individual blog posts
  for (const post of blogPosts) {
    const slug = post.slug ?? post._slug;
    if (!slug) {
      continue;
    }
    pages.push({
      url: `${BASE_URL}/blog/${slug}`,
      title: post._title ?? slug,
      description: post.description ?? "",
    });
  }

  // Changelog listing page
  pages.push({
    url: `${BASE_URL}/changelog`,
    title: "Changelog",
    description: "What's new in Lightfast — product updates and improvements.",
  });

  // Individual changelog entries
  for (const entry of changelogEntries) {
    const slug = entry.slug ?? entry._slug;
    if (!slug) {
      continue;
    }
    pages.push({
      url: `${BASE_URL}/changelog/${slug}`,
      title: entry._title ?? slug,
      description: "",
    });
  }

  // Legal pages
  for (const page of legalPages) {
    if (!page._slug) {
      continue;
    }
    pages.push({
      url: `${BASE_URL}/legal/${page._slug}`,
      title: page._title ?? page._slug,
      description: page.description ?? "",
    });
  }

  return pages;
}

export async function GET() {
  const HOME: PageEntry = {
    url: BASE_URL,
    title: "The Operating Layer for Agents and Apps",
    description:
      "Lightfast is the operating layer between your agents and apps. Observe what's happening across your tools, remember what happened, and give agents and people a single system to reason and act through.",
  };

  const [staticPages, cmsPages] = await Promise.all([
    collectStaticPages(),
    collectCmsPages(),
  ]);

  const allPages = [HOME, ...staticPages, ...cmsPages];

  const ORDER = ["Marketing", "Use Cases", "Docs", "API Reference", "Legal"];
  const groups = new Map<string, PageEntry[]>(ORDER.map((k) => [k, []]));

  for (const page of allPages) {
    const key = sectionOf(page.url);
    const bucket = groups.get(key) ?? [];
    bucket.push(page);
    if (!groups.has(key)) {
      groups.set(key, bucket);
    }
  }

  for (const items of groups.values()) {
    items.sort((a, b) => {
      if (a.url === BASE_URL) {
        return -1;
      }
      if (b.url === BASE_URL) {
        return 1;
      }
      return a.url.localeCompare(b.url);
    });
  }

  const lines: string[] = [
    "# Lightfast",
    "",
    "> The operating layer for AI agents and engineering teams. Agents and developers use Lightfast to observe events, build semantic memory, and act across their entire tool stack — giving AI systems persistent, source-cited knowledge of everything that happens across code, deployments, incidents, and decisions.",
    "",
  ];

  for (const [label, items] of groups) {
    if (!items.length) {
      continue;
    }
    lines.push(`## ${label}`);
    lines.push("");
    for (const { url, title, description } of items) {
      lines.push(
        `- [${title}](${url})${description ? `: ${description}` : ""}`
      );
    }
    lines.push("");
  }

  lines.push("## Contact & Support");
  lines.push("");
  lines.push("- Email: hello@lightfast.ai");
  lines.push(
    "- Founder: Jeevan Pillay — jp@lightfast.ai — https://twitter.com/jeevanpillay"
  );
  lines.push("- Support: support@lightfast.ai");
  lines.push("- Twitter: https://twitter.com/lightfastai");
  lines.push("- Discord: https://discord.gg/YqPDfcar2C");
  lines.push("- GitHub (org): https://github.com/lightfastai");
  lines.push("- GitHub (SDK + MCP): https://github.com/lightfastai/lightfast");
  lines.push("- npm (SDK): https://www.npmjs.com/package/lightfast");
  lines.push(
    "- npm (MCP server): https://www.npmjs.com/package/@lightfastai/mcp"
  );
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
