import { basehub } from "basehub";
import type { Operation } from "basehub/api-transaction";
import { basehubEnv } from "@vendor/cms/env";
import { markdownToBaseHubJson } from "../utils/markdown-to-basehub";

// Extract update operation types
type UpdateOp = Extract<Operation, { type: "update" }>;
type UpdateValue = NonNullable<UpdateOp["value"]>;

// Return type for mutation functions
interface MutationResult {
  transaction: { message: string | null; status: string };
}

/**
 * SEO input for changelog entries
 */
export interface ChangelogSeoInput {
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  secondaryKeyword?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  faq?: {
    question: string;
    answer: string;
  }[];
}

/**
 * Input type for creating a changelog entry via BaseHub mutation.
 * Maps to ChangelogPagesItem schema fields.
 */
export interface ChangelogEntryInput {
  /** Main title displayed in changelog list (e.g., "Neural Memory Foundation") */
  title: string;
  /** Version prefix for breadcrumb display (e.g., "0-1", format: \d+-\d+) */
  prefix: string;
  /** Descriptive URL slug without version prefix (e.g., "lightfast-neural-memory-foundation-2026") */
  slug: string;
  /** Main content as markdown - rendered via RichText */
  body: string;
  /** Bullet list of improvements (plain text, newline-separated) */
  improvements?: string;
  /** Bullet list of infrastructure changes */
  infrastructure?: string;
  /** Bullet list of bug fixes */
  fixes?: string;
  /** Bullet list of patches */
  patches?: string;
  // AEO fields
  /** BaseHub asset ID for featured image */
  featuredImageId?: string;
  /** ISO 8601 date string for publish date (defaults to createdAt) */
  publishedAt?: string;
  /** Short excerpt for listings and feeds (max 300 chars) */
  excerpt?: string;
  /** Brief summary optimized for AI citation (50-100 words) */
  tldr?: string;
  /** SEO metadata and FAQ schema */
  seo?: ChangelogSeoInput;
}

const getMutationClient = () => {
  return basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
};

/**
 * Get the changelog post collection ID for use as parentId in create mutations.
 */
async function getChangelogCollectionId(): Promise<string> {
  const client = getMutationClient();
  const result = await client.query({
    changelog: {
      post: {
        _id: true,
      },
    },
  });
  return (result as { changelog: { post: { _id: string } } }).changelog.post._id;
}

/**
 * Build SEO instance value for BaseHub mutation
 */
function buildSeoValue(seo: ChangelogSeoInput) {
  return {
    type: "instance" as const,
    value: {
      ...(seo.metaTitle !== undefined && {
        metaTitle: { type: "text" as const, value: seo.metaTitle },
      }),
      ...(seo.metaDescription !== undefined && {
        metaDescription: { type: "text" as const, value: seo.metaDescription },
      }),
      ...(seo.focusKeyword !== undefined && {
        focusKeyword: { type: "text" as const, value: seo.focusKeyword },
      }),
      ...(seo.secondaryKeyword !== undefined && {
        secondaryKeyword: { type: "text" as const, value: seo.secondaryKeyword },
      }),
      ...(seo.canonicalUrl !== undefined && {
        canonicalUrl: { type: "text" as const, value: seo.canonicalUrl },
      }),
      ...(seo.noIndex !== undefined && {
        noIndex: { type: "boolean" as const, value: seo.noIndex },
      }),
      ...(seo.faq && seo.faq.length > 0 && {
        faq: {
          type: "collection" as const,
          value: seo.faq.map((item) => ({
            type: "instance" as const,
            value: {
              question: { type: "text" as const, value: item.question },
              answer: { type: "text" as const, value: item.answer },
            },
          })),
        },
      }),
    },
  };
}

/**
 * Create a new changelog entry in BaseHub.
 * Requires BASEHUB_ADMIN_TOKEN environment variable.
 */
export async function createChangelogEntry(data: ChangelogEntryInput): Promise<MutationResult> {
  const client = getMutationClient();
  const parentId = await getChangelogCollectionId();

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Create changelog: ${data.title}`,
        data: [{
          type: "create",
          parentId: parentId,
          data: {
            type: "instance",
            title: data.title,
            value: {
              // Version prefix for breadcrumb (e.g., "0-1")
              prefix: { type: "text", value: data.prefix },
              // Custom slug field (different from _slug system field)
              slug: { type: "text", value: data.slug },
              body: {
                type: "rich-text",
                value: {
                  format: "json",
                  value: markdownToBaseHubJson(data.body),
                },
              },
              // Optional categorized sections - only include if provided
              ...(data.improvements && {
                improvements: { type: "text", value: data.improvements },
              }),
              ...(data.infrastructure && {
                infrastructure: { type: "text", value: data.infrastructure },
              }),
              ...(data.fixes && {
                fixes: { type: "text", value: data.fixes },
              }),
              ...(data.patches && {
                patches: { type: "text", value: data.patches },
              }),
              // AEO fields
              ...(data.featuredImageId && {
                featuredImage: { type: "image" as const, value: { url: data.featuredImageId } },
              }),
              ...(data.publishedAt && {
                publishedAt: { type: "date", value: data.publishedAt },
              }),
              ...(data.excerpt !== undefined && {
                excerpt: { type: "text", value: data.excerpt },
              }),
              ...(data.tldr !== undefined && {
                tldr: { type: "text", value: data.tldr },
              }),
              ...(data.seo && { seo: buildSeoValue(data.seo) }),
            },
          },
        }],
      },
      message: true,
      status: true,
    },
  });
}

/**
 * Update an existing changelog entry.
 */
export async function updateChangelogEntry(
  entryId: string,
  data: Partial<ChangelogEntryInput>,
): Promise<MutationResult> {
  const client = getMutationClient();

  // Build value updates object with proper type assertions
  const valueUpdates: UpdateValue = {
    ...(data.prefix !== undefined && {
      prefix: { type: "text" as const, value: data.prefix },
    }),
    ...(data.body && {
      body: {
        type: "rich-text" as const,
        value: { format: "json" as const, value: markdownToBaseHubJson(data.body) },
      },
    }),
    ...(data.improvements !== undefined && {
      improvements: { type: "text" as const, value: data.improvements },
    }),
    ...(data.infrastructure !== undefined && {
      infrastructure: { type: "text" as const, value: data.infrastructure },
    }),
    ...(data.fixes !== undefined && {
      fixes: { type: "text" as const, value: data.fixes },
    }),
    ...(data.patches !== undefined && {
      patches: { type: "text" as const, value: data.patches },
    }),
    // AEO fields - for updates, image fields use "media" type
    ...(data.featuredImageId !== undefined && {
      featuredImage: { type: "media" as const, value: { url: data.featuredImageId } },
    }),
    ...(data.publishedAt !== undefined && {
      publishedAt: { type: "date" as const, value: data.publishedAt },
    }),
    ...(data.excerpt !== undefined && {
      excerpt: { type: "text" as const, value: data.excerpt },
    }),
    ...(data.tldr !== undefined && {
      tldr: { type: "text" as const, value: data.tldr },
    }),
    ...(data.seo !== undefined && {
      seo: buildSeoValue(data.seo),
    }),
  };

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Update changelog: ${data.title ?? entryId}`,
        data: [{
          type: "update" as const,
          id: entryId,
          ...(data.title && { title: data.title }),
          ...(data.slug && { slug: data.slug }),
          ...(Object.keys(valueUpdates).length > 0 && { value: valueUpdates }),
        }],
      },
      message: true,
      status: true,
    },
  });
}
