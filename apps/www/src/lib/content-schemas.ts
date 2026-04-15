import { z } from "zod";

// Mirror of providerSlugSchema from @repo/app-providers/client. Inlined because
// fumadocs-mdx's build-time loader can't resolve the package's extensionless
// re-exports under Node ESM. Keep in sync with packages/app-providers/src/client/display.ts.
const providerSlugSchema = z.enum([
  "apollo",
  "github",
  "vercel",
  "linear",
  "sentry",
]);

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

const BasePageSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().min(1)).min(3).max(20),
  canonicalUrl: z.url(),
  ogTitle: z.string().min(1).max(70),
  ogDescription: z.string().min(50).max(160),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
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
  howToSteps: z.array(HowToStepSchema).min(2).optional(),
});

export const ChangelogEntrySchema = ContentPageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/changelog/"))
    .optional(),
  version: z.string().min(1),
  type: z.enum(["feature", "improvement", "fix", "breaking"]),
  tldr: z.string().min(20).max(300),
  improvements: z.array(z.string().min(1)).optional(),
});

export const LegalPageSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/legal/"))
    .optional(),
  updatedAt: z.iso.datetime(),
  effectiveAt: z.iso.datetime(),
});

const IntegrationStatusSchema = z.enum(["live", "beta", "planned"]);
const IntegrationCategorySchema = z.enum([
  "dev-tools",
  "monitoring",
  "comms",
  "data",
  "project-management",
]);

// Mirror of IntegrationLogoIcons keys from @repo/ui/integration-icons. Inlined
// because fumadocs-mdx's build-time loader can't resolve TSX component exports
// under Node ESM. Keep in sync with packages/ui/src/components/integration-icons.tsx.
const integrationIconKeySchema = z.enum([
  "apollo",
  "airtable",
  "claude",
  "codex",
  "datadog",
  "discord",
  "github",
  "linear",
  "notion",
  "posthog",
  "sentry",
  "slack",
  "vercel",
  "circleci",
  "pagerduty",
  "intercom",
  "hubspot",
  "stripe",
  "grafana",
  "clerk",
  "jira",
  "mixpanel",
  "zendesk",
  "cloudflare",
  "supabase",
  "resend",
  "typeform",
  "cal-com",
  "better-stack",
  "loops",
  "segment",
  "statsig",
  "launchdarkly",
  "amplitude",
  "gong",
  "outreach",
  "instantly",
  "incident-io",
  "plain",
  "attio",
  "neon",
  "customer-io",
  "fireflies",
  "workos",
]);

const BaseIntegrationSchema = BasePageSchema.extend({
  canonicalUrl: z
    .url()
    .refine((val) => val.startsWith("https://lightfast.ai/integrations/"))
    .optional(),
  iconKey: integrationIconKeySchema,
  tagline: z.string().min(10).max(120),
  category: IntegrationCategorySchema,
  faq: z.array(FaqItemSchema).min(1).optional(),
  updatedAt: z.iso.datetime(),
});

const IntegrationPageLiveSchema = BaseIntegrationSchema.extend({
  status: z.literal("live"),
  providerId: providerSlugSchema,
  featuredImage: z.string().startsWith("/images/"),
  docsUrl: z.string().startsWith("/docs/"),
});

const IntegrationPageBetaSchema = BaseIntegrationSchema.extend({
  status: z.literal("beta"),
  providerId: providerSlugSchema,
  featuredImage: z.string().startsWith("/images/").optional(),
  docsUrl: z.string().startsWith("/docs/").optional(),
});

const IntegrationPagePlannedSchema = BaseIntegrationSchema.extend({
  status: z.literal("planned"),
  featuredImage: z.string().startsWith("/images/").optional(),
});

export const IntegrationPageSchema = z.discriminatedUnion("status", [
  IntegrationPageLiveSchema,
  IntegrationPageBetaSchema,
  IntegrationPagePlannedSchema,
]);

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

// Inferred TypeScript types
export type BlogPostData = z.infer<typeof BlogPostSchema>;
export type ChangelogEntryData = z.infer<typeof ChangelogEntrySchema>;
export type LegalPageData = z.infer<typeof LegalPageSchema>;
export type DocsPageData = z.infer<typeof DocsPageSchema>;
export type IntegrationPageData = z.infer<typeof IntegrationPageSchema>;
export type IntegrationCategory = IntegrationPageData["category"];
export type IntegrationStatus = IntegrationPageData["status"];

// Fields required by the SEO layer — satisfied structurally by BlogPostData,
// ChangelogEntryData, and DocsPageData. Derived from BlogPostData so schema
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

export type ChangelogType = ChangelogEntryData["type"];
// → "feature" | "improvement" | "fix" | "breaking"
