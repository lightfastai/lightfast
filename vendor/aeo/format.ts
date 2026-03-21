import type { LlmsTxtOptions, PageEntry } from "./types";

/**
 * Format a PageEntry[] as a spec-compliant llms.txt string.
 * Pure function — no I/O.
 */
export function toLlmsTxt(pages: PageEntry[], opts: LlmsTxtOptions): string {
  const {
    title,
    description,
    details,
    baseUrl,
    footer,
    sectionOrder = [],
    defaultSection = "General",
    sectionResolver,
  } = opts;

  // Resolve section for each page
  const resolved = pages.map((page) => ({
    ...page,
    section:
      page.section ??
      (sectionResolver
        ? (sectionResolver(page.url) ?? defaultSection)
        : defaultSection),
  }));

  // Build ordered section map (insertion order = display order)
  const groups = new Map<string, PageEntry[]>(sectionOrder.map((k) => [k, []]));

  for (const page of resolved) {
    const key = page.optional ? "Optional" : page.section;
    const bucket = groups.get(key) ?? [];
    bucket.push(page);
    if (!groups.has(key)) {
      groups.set(key, bucket);
    }
  }

  // Sort within groups: baseUrl entry pinned first, then lexicographic
  for (const items of groups.values()) {
    items.sort((a, b) => {
      if (a.url === baseUrl) {
        return -1;
      }
      if (b.url === baseUrl) {
        return 1;
      }
      return a.url.localeCompare(b.url);
    });
  }

  const lines: string[] = [`# ${title}`, ""];

  if (description) {
    lines.push(`> ${description}`, "");
  }
  if (details) {
    lines.push(details, "");
  }

  for (const [label, items] of groups) {
    if (!items.length) {
      continue;
    }
    lines.push(`## ${label}`, "");
    for (const { url, title: pageTitle, description: pageDesc } of items) {
      lines.push(`- [${pageTitle}](${url})${pageDesc ? `: ${pageDesc}` : ""}`);
    }
    lines.push("");
  }

  if (footer?.length) {
    lines.push(...footer, "");
  }

  return lines.join("\n");
}
