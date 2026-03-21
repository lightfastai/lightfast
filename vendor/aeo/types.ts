/** A single discoverable page — the universal unit of data in aeo. */
export interface PageEntry {
  /** Optional short description (1–2 sentences). */
  description?: string;
  /** ISO 8601 date of last modification, if known. */
  lastModified?: string;
  /**
   * When true, this entry goes into the `## Optional` section
   * (spec-reserved: tools may skip these for brevity).
   */
  optional?: boolean;
  /**
   * llms.txt section name this page belongs to.
   * Maps to an H2 heading in the output.
   * Pages without a section use `LlmsTxtOptions.defaultSection`.
   */
  section?: string;
  /** Human-readable title. */
  title: string;
  /** Canonical absolute URL of the page. */
  url: string;
}

/** A function that returns additional dynamic pages (CMS, DB, etc.). */
export type PageProvider = () => Promise<PageEntry[]>;

/** Options for the HTML discovery layer. */
export interface DiscoveryOptions {
  /**
   * Absolute path to the Next.js build output.
   * Default: `process.cwd()/.next/server/app`
   */
  buildOutputDir?: string;
  /**
   * Additional file-level patterns to skip before reading HTML.
   * Merged with built-in defaults (not-found, global-error, opengraph-image, twitter-image).
   */
  skipFile?: RegExp[];
  /**
   * Additional URL patterns to exclude from the output.
   * Merged with built-in defaults (llms, sitemap, robots, feeds, unresolved segments).
   */
  skipUrl?: RegExp[];
  /**
   * Strip this suffix from extracted page titles.
   * E.g. `"Lightfast"` strips ` | Lightfast` from titles like `"Pricing | Lightfast"`.
   */
  stripTitleSuffix?: string;
}

/** Options for the llms.txt formatter. */
export interface LlmsTxtOptions {
  /** Base URL used to resolve relative URLs and pin the homepage first in its section. */
  baseUrl: string;
  /** Default section name for pages without an explicit `PageEntry.section`. */
  defaultSection?: string;
  /** Tagline or summary — appears as the `>` blockquote. */
  description?: string;
  /** Optional body prose between the blockquote and first H2. */
  details?: string;
  /** Lines appended verbatim after all sections (e.g. contact info block). */
  footer?: string[];
  /** Section ordering. Sections not in this list are appended in discovery order. */
  sectionOrder?: string[];
  /**
   * Maps a URL to its section name for static pages (which have no section set by a provider).
   * Return `undefined` to fall back to `defaultSection`.
   */
  sectionResolver?: (url: string) => string | undefined;
  /** Site title — appears as the H1. Required by spec. */
  title: string;
}

/** Options for the route handler (HTTP-level concerns, separate from formatter options). */
export interface HandlerOptions {
  /**
   * Value for the `Cache-Control` response header.
   * Required — consumers must set this explicitly (no silent default in the package).
   * E.g. `"public, max-age=86400, s-maxage=86400"` for a 24-hour CDN cache.
   */
  cacheControl: string;
}
