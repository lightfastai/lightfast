import { basehub } from "basehub";
import type { Scalars } from "basehub";
import { basehubEnv } from "@vendor/cms/env";

// Reuse scalar enums from generated Basehub types
export type ContentType = Scalars["BSHBSelect__442379851"];
export type BusinessGoal = Scalars["BSHBSelect__1319627841"];
export type CTAType = Scalars["BSHBSelect_957971831"];
export type PostStatus = Scalars["BSHBSelect_950708073"];

// Narrow input type for distribution component (matches DistributionComponent fields)
export type DistributionInput = {
  businessGoal?: BusinessGoal | null;
  primaryProductArea?: string | null;
  targetPersona?: string | null;
  campaignTag?: string | null;
  distributionChannels?: string[] | null;
};

// Narrow input type for engagement component (matches EngagementComponent fields)
export type EngagementInput = {
  ctaType?: CTAType | null;
  ctaTitle?: string | null;
  ctaDescriptionMarkdown?: string | null;
  ctaButtonText?: string | null;
  ctaButtonUrl?: string | null;
};

// Input type for creating a blog post via AI, aligned with the PostItem schema
export type AIGeneratedPost = {
  // Core content fields
  title: string;
  slug?: string;
  description: string;
  excerpt: string;
  content: string;
  contentType: ContentType;

  // SEO fields (maps to SeoComponent)
  seo: {
    focusKeyword: string;
    secondaryKeywords: string[];
    metaDescription?: string;
    metaTitle?: string;
    canonicalUrl?: string;
    noIndex?: boolean;
  };

  // Distribution component
  distribution?: DistributionInput;

  // Engagement component (CTA)
  engagement?: EngagementInput;

  // Relationships
  categoryIds: string[]; // CategoriesItem IDs
  authorIds: string[]; // AuthorItem IDs
  relatedPostIds?: string[]; // PostItem IDs

  // Media (optional)
  featuredImageId?: string | null; // BlockImage ID
  ogImageId?: string | null; // BlockOgImage ID
  videoId?: string | null; // BlockVideo ID

  // Publishing
  publishedAt?: Date;
  status?: PostStatus;
};

const getMutationClient = () => {
  return basehub({ token: basehubEnv.BASEHUB_ADMIN_TOKEN });
};

/**
 * Get the blog.post collection ID for use as parentId in create mutations.
 */
async function getBlogPostCollectionId(): Promise<string> {
  const client = getMutationClient();
  const result = await client.query({
    blog: {
      post: {
        _id: true,
      },
    },
  });
  return (result as { blog: { post: { _id: string } } }).blog.post._id;
}

export async function createBlogPostFromAI(data: AIGeneratedPost) {
  const client = getMutationClient();
  const parentId = await getBlogPostCollectionId();

  const publishedAtIso =
    data.publishedAt?.toISOString() ?? new Date().toISOString();

  const distributionChannels =
    data.distribution?.distributionChannels &&
    data.distribution.distributionChannels.length > 0
      ? data.distribution.distributionChannels.join(", ")
      : undefined;

  const seoMetaDescription =
    data.seo.metaDescription ?? data.description.slice(0, 160);

  const seoMetaTitle = data.seo.metaTitle ?? data.title;

  // Build the value object with proper field types
  const valueFields: Record<string, unknown> = {
    slug: { type: "text", value: data.slug ?? "" },
    description: { type: "text", value: data.description },
    body: {
      type: "rich-text",
      value: { format: "markdown", value: data.content },
    },
    excerpt: {
      type: "rich-text",
      value: { format: "markdown", value: data.excerpt },
    },
    status: { type: "select", value: data.status ?? "draft" },
    publishedAt: { type: "date", value: publishedAtIso },
    contentType: { type: "select", value: data.contentType },
    authors: { type: "reference", value: data.authorIds },
    categories: { type: "reference", value: data.categoryIds },
  };

  // Add optional fields
  if (data.featuredImageId) {
    valueFields.featuredImage = { type: "reference", value: data.featuredImageId };
  }

  if (data.ogImageId) {
    valueFields.ogImage = { type: "reference", value: data.ogImageId };
  }

  if (data.videoId) {
    valueFields.videoUrl = { type: "reference", value: data.videoId };
  }

  if (data.relatedPostIds && data.relatedPostIds.length > 0) {
    valueFields.relatedPosts = { type: "reference", value: data.relatedPostIds };
  }

  // SEO component fields
  valueFields.seo = {
    type: "instance",
    value: {
      focusKeyword: { type: "text", value: data.seo.focusKeyword },
      secondaryKeywords: { type: "text", value: data.seo.secondaryKeywords.join(", ") },
      metaDescription: { type: "text", value: seoMetaDescription },
      metaTitle: { type: "text", value: seoMetaTitle },
      canonicalUrl: { type: "text", value: data.seo.canonicalUrl ?? null },
      noIndex: { type: "boolean", value: data.seo.noIndex ?? false },
    },
  };

  // Distribution component
  if (data.distribution) {
    valueFields.distribution = {
      type: "instance",
      value: {
        businessGoal: { type: "select", value: data.distribution.businessGoal ?? null },
        primaryProductArea: { type: "text", value: data.distribution.primaryProductArea ?? null },
        targetPersona: { type: "text", value: data.distribution.targetPersona ?? null },
        campaignTag: { type: "text", value: data.distribution.campaignTag ?? null },
        distributionChannels: { type: "text", value: distributionChannels ?? null },
      },
    };
  }

  // Engagement component
  if (data.engagement) {
    const engagementValue: Record<string, unknown> = {
      ctaType: { type: "select", value: data.engagement.ctaType ?? null },
      ctaTitle: { type: "text", value: data.engagement.ctaTitle ?? null },
      ctaButtonText: { type: "text", value: data.engagement.ctaButtonText ?? null },
      ctaButtonUrl: { type: "text", value: data.engagement.ctaButtonUrl ?? null },
    };

    if (data.engagement.ctaDescriptionMarkdown) {
      engagementValue.ctaDescription = {
        type: "rich-text",
        value: { format: "markdown", value: data.engagement.ctaDescriptionMarkdown },
      };
    }

    valueFields.engagement = {
      type: "instance",
      value: engagementValue,
    };
  }

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `AI: Create post - ${data.title}`,
        data: [{
          type: "create",
          parentId: parentId,
          data: {
            type: "instance",
            title: data.title,
            value: valueFields,
          },
        }],
      },
      message: true,
      status: true,
    },
  });
}

export async function updatePostStatus(
  postId: string,
  status: Extract<PostStatus, "published" | "archived">,
) {
  const client = getMutationClient();

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `Update post status to ${status}`,
        data: [{
          type: "update",
          id: postId,
          value: {
            status: { type: "select", value: status },
          },
        }],
      },
      message: true,
      status: true,
    },
  });
}
