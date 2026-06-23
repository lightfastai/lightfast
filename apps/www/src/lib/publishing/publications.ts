import type { GraphContext } from "@vendor/seo/json-ld";
import type { Metadata } from "next";
import type { MDXContent } from "mdx/types";
import {
  buildBlogIndexJsonLd,
  buildBlogPostJsonLd,
  buildContentPageJsonLd,
  buildLegalJsonLd,
} from "./json-ld";
import {
  buildBlogIndexMetadata,
  buildBlogPostMetadata,
  buildBrandMetadata,
  buildHomeMetadata,
  buildLegalMetadata,
} from "./metadata";
import type {
  BlogPostData,
  BrandPageData,
  HomePageData,
  LegalPageData,
} from "./schemas";
import {
  getBlogDocument,
  getBlogDocuments,
  getBrandDocument,
  getHomeDocument,
  getLegalDocument,
  getLegalDocuments,
} from "./source";
import { absoluteUrl } from "./site";

interface BasePublication<Kind extends string> {
  readonly canonicalUrl: string;
  readonly description: string;
  readonly isPublic: boolean;
  readonly jsonLd: GraphContext;
  readonly kind: Kind;
  readonly lastModified: string;
  readonly metadata: Metadata;
  readonly nofollow: boolean;
  readonly pathname: string;
  readonly title: string;
  readonly url: string;
}

interface ContentPublication<Kind extends string>
  extends BasePublication<Kind> {
  readonly body: MDXContent;
}

export interface HomePublication extends ContentPublication<"home"> {
  readonly answerSummary?: string;
}

export interface BrandPublication extends ContentPublication<"brand"> {}

export interface LegalPublication extends ContentPublication<"legal"> {
  readonly effectiveAt: string;
  readonly slug: string;
}

export interface BlogPostPublication
  extends ContentPublication<"blog-post"> {
  readonly answerSummary?: string;
  readonly featuredImage?: string;
  readonly publishedAt: string;
  readonly slug: string;
  readonly tldr: string;
  readonly updatedAt: string;
}

export interface BlogIndexPostSummary {
  readonly canonicalUrl: string;
  readonly description: string;
  readonly lastModified: string;
  readonly pathname: string;
  readonly publishedAt: string;
  readonly slug: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly url: string;
}

export interface BlogIndexPublication
  extends BasePublication<"blog-index"> {
  readonly posts: readonly BlogIndexPostSummary[];
}

export type StaticPublication =
  | HomePublication
  | BrandPublication
  | BlogIndexPublication
  | BlogPostPublication
  | LegalPublication;

export interface StaticParam {
  readonly slug: string;
}

function isPublic(data: { noindex: boolean }): boolean {
  return !data.noindex;
}

function lastModified(
  data: { publishedAt?: string; reviewedAt?: string; updatedAt: string }
): string {
  return data.reviewedAt ?? data.updatedAt ?? data.publishedAt;
}

function sortByPublishedAtDesc<T extends { publishedAt: string }>(
  records: readonly T[]
): T[] {
  return [...records].sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

function slugFrom(slugs: readonly string[]): string {
  return slugs[0] ?? "";
}

function blogPostPathname(slug: string): string {
  return `/blog/${slug}`;
}

function legalPathname(slug: string): string {
  return `/legal/${slug}`;
}

function buildHomePublication(data: HomePageData & { body: MDXContent }) {
  const pathname = "/";
  const url = absoluteUrl(pathname);
  const canonicalUrl = data.canonicalUrl ?? url;
  const modified = lastModified(data);

  return {
    kind: "home",
    title: data.title,
    description: data.description,
    answerSummary: data.answerSummary,
    body: data.body,
    pathname,
    url,
    canonicalUrl,
    lastModified: modified,
    isPublic: isPublic(data),
    nofollow: data.nofollow,
    metadata: buildHomeMetadata(data, canonicalUrl),
    jsonLd: buildContentPageJsonLd({
      data: {
        title: data.title,
        description: data.description,
        lastModified: modified,
      },
      url: canonicalUrl,
    }),
  } satisfies HomePublication;
}

function buildBrandPublication(data: BrandPageData & { body: MDXContent }) {
  const pathname = "/brand";
  const url = absoluteUrl(pathname);
  const canonicalUrl = data.canonicalUrl ?? url;
  const modified = lastModified(data);

  return {
    kind: "brand",
    title: data.title,
    description: data.description,
    body: data.body,
    pathname,
    url,
    canonicalUrl,
    lastModified: modified,
    isPublic: isPublic(data),
    nofollow: data.nofollow,
    metadata: buildBrandMetadata(data, canonicalUrl),
    jsonLd: buildContentPageJsonLd({
      data: {
        title: data.title,
        description: data.description,
        lastModified: modified,
      },
      url: canonicalUrl,
    }),
  } satisfies BrandPublication;
}

function buildBlogPostPublication(
  slug: string,
  data: BlogPostData & { body: MDXContent }
) {
  const pathname = blogPostPathname(slug);
  const url = absoluteUrl(pathname);
  const canonicalUrl = data.canonicalUrl ?? url;
  const modified = lastModified(data);

  return {
    kind: "blog-post",
    title: data.title,
    description: data.description,
    answerSummary: data.answerSummary,
    body: data.body,
    featuredImage: data.featuredImage,
    pathname,
    publishedAt: data.publishedAt,
    slug,
    tldr: data.tldr,
    updatedAt: data.updatedAt,
    url,
    canonicalUrl,
    lastModified: modified,
    isPublic: isPublic(data),
    nofollow: data.nofollow,
    metadata: buildBlogPostMetadata(data, canonicalUrl),
    jsonLd: buildBlogPostJsonLd(data, canonicalUrl),
  } satisfies BlogPostPublication;
}

function buildLegalPublication(
  slug: string,
  data: LegalPageData & { body: MDXContent }
) {
  const pathname = legalPathname(slug);
  const url = absoluteUrl(pathname);
  const canonicalUrl = data.canonicalUrl ?? url;
  const modified = lastModified(data);

  return {
    kind: "legal",
    title: data.title,
    description: data.description,
    body: data.body,
    effectiveAt: data.effectiveAt,
    pathname,
    slug,
    url,
    canonicalUrl,
    lastModified: modified,
    isPublic: isPublic(data),
    nofollow: data.nofollow,
    metadata: buildLegalMetadata(data, canonicalUrl),
    jsonLd: buildLegalJsonLd(data, canonicalUrl, modified),
  } satisfies LegalPublication;
}

function toBlogPostSummary(
  publication: BlogPostPublication
): BlogIndexPostSummary {
  return {
    canonicalUrl: publication.canonicalUrl,
    title: publication.title,
    description: publication.description,
    lastModified: publication.lastModified,
    pathname: publication.pathname,
    publishedAt: publication.publishedAt,
    slug: publication.slug,
    updatedAt: publication.updatedAt,
    url: publication.url,
  };
}

function buildBlogIndexPublication(posts: readonly BlogPostPublication[]) {
  const pathname = "/blog";
  const url = absoluteUrl(pathname);
  const publicPosts = sortByPublishedAtDesc(posts.filter((post) => post.isPublic));
  const summaries = publicPosts.map(toBlogPostSummary);
  const lastModifiedDate =
    summaries[0]?.lastModified ?? "1970-01-01T00:00:00.000Z";

  return {
    kind: "blog-index",
    title: "Blog",
    description:
      "Notes from Lightfast on applied AI, real-time collaboration, product engineering, evals, and the systems we build.",
    pathname,
    posts: summaries,
    url,
    canonicalUrl: url,
    lastModified: lastModifiedDate,
    isPublic: true,
    nofollow: false,
    metadata: buildBlogIndexMetadata(url),
    jsonLd: buildBlogIndexJsonLd({
      lastModified: lastModifiedDate,
      posts: summaries,
      url,
    }),
  } satisfies BlogIndexPublication;
}

export function getHomePublication(): HomePublication | undefined {
  const document = getHomeDocument();
  return document ? buildHomePublication(document.data) : undefined;
}

export function getBrandPublication(): BrandPublication | undefined {
  const document = getBrandDocument();
  return document ? buildBrandPublication(document.data) : undefined;
}

export function getBlogPostPublication(
  slug: string
): BlogPostPublication | undefined {
  const document = getBlogDocument(slug);
  return document ? buildBlogPostPublication(slug, document.data) : undefined;
}

export function getLegalPublication(slug: string): LegalPublication | undefined {
  const document = getLegalDocument(slug);
  return document ? buildLegalPublication(slug, document.data) : undefined;
}

export function getBlogPostStaticParams(): StaticParam[] {
  return getBlogDocuments().map((document) => ({
    slug: slugFrom(document.slugs),
  }));
}

export function getLegalStaticParams(): StaticParam[] {
  return getLegalDocuments().map((document) => ({
    slug: slugFrom(document.slugs),
  }));
}

export function getBlogPostPublications(): BlogPostPublication[] {
  return sortByPublishedAtDesc(
    getBlogDocuments()
      .map((document) =>
        buildBlogPostPublication(slugFrom(document.slugs), document.data)
      )
      .filter((publication) => publication.slug.length > 0)
  );
}

export function getLegalPublications(): LegalPublication[] {
  return getLegalDocuments()
    .map((document) =>
      buildLegalPublication(slugFrom(document.slugs), document.data)
    )
    .filter((publication) => publication.slug.length > 0)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getBlogIndexPublication(): BlogIndexPublication {
  return buildBlogIndexPublication(getBlogPostPublications());
}

export function getAllPublications(): StaticPublication[] {
  return [
    getHomePublication(),
    getBrandPublication(),
    getBlogIndexPublication(),
    ...getBlogPostPublications(),
    ...getLegalPublications(),
  ].filter((publication): publication is StaticPublication => Boolean(publication));
}

export function getPublicPublications(): StaticPublication[] {
  return getAllPublications().filter((publication) => publication.isPublic);
}
