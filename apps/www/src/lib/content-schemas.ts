import { z } from "zod";

const AuthorSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  twitterHandle: z.string().min(1),
  jobTitle: z.string().min(1).optional(),
});

const FaqItemSchema = z.object({
  question: z.string().min(10),
  answer: z.string().min(20),
});

const HowToStepSchema = z.object({
  name: z.string().min(1),
  text: z.string().min(20),
  url: z.url().optional(),
});

const AeoPlanningSchema = z
  .object({
    targetPrompts: z.array(z.string().min(10)).default([]),
    fanoutQueries: z.array(z.string().min(3)).default([]),
    entities: z.array(z.string().min(1)).default([]),
    citationTargets: z.array(z.url()).default([]),
  })
  .default({
    targetPrompts: [],
    fanoutQueries: [],
    entities: [],
    citationTargets: [],
  });

const BasePageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().min(1)).min(3).max(20),
  canonicalUrl: z.url(),
  ogTitle: z.string().min(1).max(70),
  ogDescription: z.string().min(50).max(160),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  reviewedAt: z.iso.datetime().optional(),
  answerSummary: z.string().min(40).max(320).optional(),
  aeo: AeoPlanningSchema,
});

const ContentPageSchema = BasePageSchema.extend({
  authors: z.array(AuthorSchema).min(1),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  faq: z.array(FaqItemSchema).min(1),
  featuredImage: z.string().startsWith("/images/").optional(),
});

export const BlogPostSchema = ContentPageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/v2/blog/"))
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
  howToSteps: z.array(HowToStepSchema).min(2).optional(),
});

export const BrandPageSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val === "https://lightfast.ai/v2/brand")
    .optional(),
  updatedAt: z.iso.datetime(),
});

export const LegalPageSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/v2/legal/"))
    .optional(),
  updatedAt: z.iso.datetime(),
  effectiveAt: z.iso.datetime(),
});

// Inferred TypeScript types
export type BlogPostData = z.infer<typeof BlogPostSchema>;
export type BrandPageData = z.infer<typeof BrandPageSchema>;
export type LegalPageData = z.infer<typeof LegalPageSchema>;

// Fields required by the SEO layer. Derived from BlogPostData so schema
// renames propagate here automatically.
export type ContentSeoData = Pick<
  BlogPostData,
  | "authors"
  | "description"
  | "keywords"
  | "nofollow"
  | "noindex"
  | "ogDescription"
  | "ogTitle"
  | "publishedAt"
  | "title"
  | "updatedAt"
>;

// Derived from Zod — Zod is the sole source of truth for these unions
export type BlogCategory = BlogPostData["category"];
// → "engineering" | "product" | "company" | "tutorial" | "research"
