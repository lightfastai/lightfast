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

export async function createBlogPostFromAI(data: AIGeneratedPost) {
  const client = getMutationClient();

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

  return client.mutation({
    transaction: {
      __args: {
        autoCommit: `AI: Create post - ${data.title}`,
        data: {
          // BaseHub Transaction "create" for the blog.post list
          type: "create",
          _table: "blog.post",
          _title: data.title,
          slug: data.slug,
          description: data.description,
          body: {
            type: "rich-text",
            markdown: data.content,
          },
          excerpt: {
            type: "rich-text",
            markdown: data.excerpt,
          },
          seo: {
            focusKeyword: data.seo.focusKeyword,
            secondaryKeywords: data.seo.secondaryKeywords.join(", "),
            metaDescription: seoMetaDescription,
            metaTitle: seoMetaTitle,
            canonicalUrl: data.seo.canonicalUrl,
            noIndex: data.seo.noIndex ?? false,
          },
          distribution: data.distribution && {
            businessGoal: data.distribution.businessGoal ?? null,
            primaryProductArea: data.distribution.primaryProductArea ?? null,
            targetPersona: data.distribution.targetPersona ?? null,
            campaignTag: data.distribution.campaignTag ?? null,
            distributionChannels: distributionChannels ?? null,
          },
          engagement: data.engagement && {
            ctaType: data.engagement.ctaType ?? null,
            ctaTitle: data.engagement.ctaTitle ?? null,
            ctaButtonText: data.engagement.ctaButtonText ?? null,
            ctaButtonUrl: data.engagement.ctaButtonUrl ?? null,
            ctaDescription: data.engagement.ctaDescriptionMarkdown && {
              type: "rich-text",
              markdown: data.engagement.ctaDescriptionMarkdown,
            },
          },
          status: data.status ?? "draft",
          publishedAt: {
            type: "date",
            value: publishedAtIso,
          },
          contentType: data.contentType,
          featuredImage: data.featuredImageId && {
            type: "reference",
            id: data.featuredImageId,
          },
          ogImage: data.ogImageId && {
            type: "reference",
            id: data.ogImageId,
          },
          videoUrl: data.videoId && {
            type: "reference",
            id: data.videoId,
          },
          author: {
            type: "reference",
            ids: data.authorIds,
          },
          categories: {
            type: "reference",
            ids: data.categoryIds,
          },
          relatedPosts:
            data.relatedPostIds && data.relatedPostIds.length > 0
              ? {
                  type: "reference",
                  ids: data.relatedPostIds,
                }
              : undefined,
        },
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
        data: {
          type: "update",
          id: postId,
          status,
        },
      },
      message: true,
      status: true,
    },
  });
}
