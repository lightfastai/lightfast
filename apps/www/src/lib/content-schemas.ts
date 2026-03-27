import { z } from "zod";

export const AuthorSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  twitterHandle: z.string().min(1),
});

export const FaqItemSchema = z.object({
  question: z.string().min(10),
  answer: z.string().min(20),
});

export const BasePageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().min(1)).min(3).max(20),
  canonicalUrl: z.url(),
  ogTitle: z.string().min(1).max(70),
  ogDescription: z.string().min(50).max(160),
  ogImage: z.url(),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
});

export const ContentPageSchema = BasePageSchema.extend({
  authors: z.array(AuthorSchema).min(1),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  faq: z.array(FaqItemSchema).min(1),
});

export const BlogPostSchema = ContentPageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/blog/"))
    .optional(),
  category: z.enum([
    "engineering",
    "product",
    "company",
    "tutorial",
    "research",
  ]),
  readingTimeMinutes: z.number().int().min(1),
  featured: z.boolean().default(false),
  tldr: z.string().min(20).max(300),
});

export const ChangelogEntrySchema = ContentPageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/changelog/"))
    .optional(),
  version: z.string().min(1),
  type: z.enum(["feature", "improvement", "fix", "breaking"]),
  tldr: z.string().min(20).max(300),
});

export const LegalPageSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/legal/"))
    .optional(),
  updatedAt: z.iso.datetime(),
  effectiveAt: z.iso.datetime(),
});

export const DocsPageSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/docs/"))
    .optional(),
  authors: z.array(AuthorSchema).min(1),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  proficiencyLevel: z
    .enum(["Beginner", "Intermediate", "Advanced", "Expert"])
    .optional(),
});

export const MarketingPageSchema = BasePageSchema.extend({
  faq: z.array(FaqItemSchema).min(1),
});

// Inferred TypeScript types
export type BasePageData = z.infer<typeof BasePageSchema>;
export type BlogPostData = z.infer<typeof BlogPostSchema>;
export type ChangelogEntryData = z.infer<typeof ChangelogEntrySchema>;
export type LegalPageData = z.infer<typeof LegalPageSchema>;
export type DocsPageData = z.infer<typeof DocsPageSchema>;
export type MarketingPageData = z.infer<typeof MarketingPageSchema>;

// Derived from Zod — Zod is the sole source of truth for these unions
export type BlogCategory = BlogPostData["category"];
// → "engineering" | "product" | "company" | "tutorial" | "research"

export type ChangelogType = ChangelogEntryData["type"];
// → "feature" | "improvement" | "fix" | "breaking"
