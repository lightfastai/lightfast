import { basehub } from "basehub";
import { basehubEnv } from "@vendor/cms/env";

/**
 * SEO input for changelog entries
 */
export type ChangelogSeoInput = {
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  secondaryKeyword?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  faq?: Array<{
    question: string;
    answer: string;
  }>;
};

/**
 * Input type for creating a changelog entry via BaseHub mutation.
 * Maps to ChangelogPagesItem schema fields.
 */
export type ChangelogEntryInput = {
  /** Main title displayed in changelog list (e.g., "Neural Memory Foundation") */
  title: string;
  /** Version slug for URL (e.g., "0-2" -> /changelog/0-2) */
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
};

const getMutationClient = () => {
  return basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
};

/**
 * Get the changelogPages collection ID for use as parentId in create mutations.
 */
async function getChangelogCollectionId(): Promise<string> {
  const client = getMutationClient();
  const result = await client.query({
    changelogPages: {
      _id: true,
    },
  });
  return (result as { changelogPages: { _id: string } }).changelogPages._id;
}

/**
 * Build SEO instance value for BaseHub mutation
 */
function buildSeoValue(seo: ChangelogSeoInput) {
  return {
    type: "instance",
    value: {
      ...(seo.metaTitle !== undefined && {
        metaTitle: { type: "text", value: seo.metaTitle },
      }),
      ...(seo.metaDescription !== undefined && {
        metaDescription: { type: "text", value: seo.metaDescription },
      }),
      ...(seo.focusKeyword !== undefined && {
        focusKeyword: { type: "text", value: seo.focusKeyword },
      }),
      ...(seo.secondaryKeyword !== undefined && {
        secondaryKeyword: { type: "text", value: seo.secondaryKeyword },
      }),
      ...(seo.canonicalUrl !== undefined && {
        canonicalUrl: { type: "text", value: seo.canonicalUrl },
      }),
      ...(seo.noIndex !== undefined && {
        noIndex: { type: "boolean", value: seo.noIndex },
      }),
      ...(seo.faq && seo.faq.length > 0 && {
        faq: {
          type: "list",
          value: seo.faq.map((item) => ({
            type: "instance",
            value: {
              question: { type: "text", value: item.question },
              answer: { type: "text", value: item.answer },
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
export async function createChangelogEntry(data: ChangelogEntryInput) {
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
              // Custom slug field (different from _slug system field)
              slug: { type: "text", value: data.slug },
              body: {
                type: "rich-text",
                value: {
                  format: "markdown",
                  value: data.body,
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
                featuredImage: { type: "image", value: data.featuredImageId },
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
) {
  const client = getMutationClient();

  const valueUpdates: Record<string, unknown> = {};

  if (data.body) {
    valueUpdates.body = {
      type: "rich-text",
      value: { format: "markdown", value: data.body },
    };
  }
  if (data.improvements !== undefined) {
    valueUpdates.improvements = { type: "text", value: data.improvements };
  }
  if (data.infrastructure !== undefined) {
    valueUpdates.infrastructure = { type: "text", value: data.infrastructure };
  }
  if (data.fixes !== undefined) {
    valueUpdates.fixes = { type: "text", value: data.fixes };
  }
  if (data.patches !== undefined) {
    valueUpdates.patches = { type: "text", value: data.patches };
  }
  // AEO fields
  if (data.featuredImageId !== undefined) {
    valueUpdates.featuredImage = { type: "image", value: data.featuredImageId };
  }
  if (data.publishedAt !== undefined) {
    valueUpdates.publishedAt = { type: "date", value: data.publishedAt };
  }
  if (data.excerpt !== undefined) {
    valueUpdates.excerpt = { type: "text", value: data.excerpt };
  }
  if (data.tldr !== undefined) {
    valueUpdates.tldr = { type: "text", value: data.tldr };
  }
  if (data.seo !== undefined) {
    valueUpdates.seo = buildSeoValue(data.seo);
  }

  const updateData: Record<string, unknown> = {
    type: "update",
    id: entryId,
  };

  if (data.title) updateData.title = data.title;
  if (data.slug) updateData.slug = data.slug;
  if (Object.keys(valueUpdates).length > 0) {
    updateData.value = valueUpdates;
  }

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Update changelog: ${data.title ?? entryId}`,
        data: [updateData],
      },
      message: true,
      status: true,
    },
  });
}
