import { z } from "zod";

const authorSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  twitterHandle: z.string().min(1),
  jobTitle: z.string().min(1).optional(),
});

const faqItemSchema = z.object({
  question: z.string().min(10),
  answer: z.string().min(20),
});

const howToStepSchema = z.object({
  name: z.string().min(1),
  text: z.string().min(20),
  url: z.url().optional(),
});

const baseContentPageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().min(1)).min(3).max(20),
  canonicalUrl: z.url().optional(),
  ogTitle: z.string().min(1).max(70),
  ogDescription: z.string().min(50).max(160),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  authors: z.array(authorSchema).min(1),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  faq: z.array(faqItemSchema).min(1),
  featuredImage: z.string().startsWith("/images/").optional(),
});

export const blogCategoryValues = [
  "engineering",
  "product",
  "company",
  "tutorial",
  "research",
] as const;

export const BlogPostSchema = baseContentPageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((value) => value.startsWith("https://lightfast.ai/blog/"))
    .optional(),
  category: z.enum(blogCategoryValues),
  readingTimeMinutes: z.number().int().min(1),
  featured: z.boolean().default(false),
  tldr: z.string().min(20).max(300),
  howToSteps: z.array(howToStepSchema).min(2).optional(),
});

export const ChangelogEntrySchema = baseContentPageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((value) => value.startsWith("https://lightfast.ai/changelog/"))
    .optional(),
  version: z.string().min(1),
  type: z.enum(["feature", "improvement", "fix", "breaking"]),
  tldr: z.string().min(20).max(300),
  improvements: z.array(z.string().min(1)).optional(),
});

export type BlogCategory = (typeof blogCategoryValues)[number];
export type BlogPostData = z.infer<typeof BlogPostSchema>;
export type ChangelogEntryData = z.infer<typeof ChangelogEntrySchema>;
