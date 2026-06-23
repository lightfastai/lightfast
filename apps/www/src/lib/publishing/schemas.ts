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

const TocItemSchema = z.object({
  title: z.string().min(1),
  depth: z.union([z.literal(2), z.literal(3)]),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
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

const BasePublicationSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().min(1)).min(3).max(20),
  ogTitle: z.string().min(1).max(70),
  ogDescription: z.string().min(50).max(160),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  reviewedAt: z.iso.datetime().optional(),
  answerSummary: z.string().min(40).max(320).optional(),
  aeo: AeoPlanningSchema,
});

const ContentPublicationSchema = BasePublicationSchema.extend({
  authors: z.array(AuthorSchema).min(1),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  faq: z.array(FaqItemSchema).min(1),
  featuredImage: z.string().startsWith("/images/").optional(),
});

export const BlogPostSchema = ContentPublicationSchema.extend({
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
  toc: z.array(TocItemSchema).default([]),
  howToSteps: z.array(HowToStepSchema).min(2).optional(),
});

export const HomePageSchema = BasePublicationSchema.extend({
  updatedAt: z.iso.datetime(),
});

export const BrandPageSchema = BasePublicationSchema.extend({
  updatedAt: z.iso.datetime(),
});

export const LegalPageSchema = BasePublicationSchema.extend({
  updatedAt: z.iso.datetime(),
  effectiveAt: z.iso.datetime(),
});

export type BlogPostData = z.infer<typeof BlogPostSchema>;
export type BrandPageData = z.infer<typeof BrandPageSchema>;
export type HomePageData = z.infer<typeof HomePageSchema>;
export type LegalPageData = z.infer<typeof LegalPageSchema>;
export type BlogCategory = BlogPostData["category"];
