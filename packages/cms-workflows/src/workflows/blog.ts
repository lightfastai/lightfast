import { createStep, createWorkflow } from "@vendor/mastra";
import { anthropic, generateObject } from "@repo/ai/ai";
import { z } from "zod";
import type { Scalars } from "basehub";

const distributionChannelsSchema = z.array(
  z.enum(["blog", "newsletter", "x", "linkedin", "docs", "community"]),
);

export const workflowInputSchema = z.object({
  rawTopic: z.string(),
  businessGoal: z.enum([
    "awareness",
    "consideration",
    "conversion",
    "retention",
  ]),
  primaryProductArea: z.string().nullable().optional(),
  targetPersona: z.string().nullable().optional(),
  campaignTag: z.string().nullable().optional(),
  distributionChannels: distributionChannelsSchema.optional(),
  targetQuestions: z.array(z.string()).optional(),
  context: z
    .object({
      issues: z.array(z.string()).optional(),
      docs: z.array(z.string()).optional(),
      existingContent: z.array(z.string()).optional(),
    })
    .optional(),
});

export const aeoPlanSchema = z.object({
  aiVisibilityGoal: z.string(),
  funnelStage: z.enum(["top", "mid", "bottom"]),
  targetQuestions: z.array(z.string()),
  entitiesToHighlight: z.array(z.string()),
  structuralDirectives: z.array(z.string()),
});

export const briefSchema = z.object({
  brief: z.object({
    topic: z.string(),
    angle: z.string(),
    businessGoal: z.enum([
      "awareness",
      "consideration",
      "conversion",
      "retention",
    ]),
    primaryProductArea: z.string(),
    targetPersona: z.string(),
    campaignTag: z.string(),
    distributionChannels: distributionChannelsSchema,
    keywords: z.object({
      primary: z.string(),
      secondary: z.array(z.string()),
    }),
    readerProfile: z.object({
      role: z.string(),
      painPoints: z.array(z.string()),
      priorKnowledge: z.string(),
    }),
    outline: z.array(
      z.object({
        heading: z.string(),
        goal: z.string(),
        notes: z.string(),
      }),
    ),
    internalLinks: z.array(
      z.object({
        label: z.string(),
        url: z.string(),
        purpose: z.string(),
      }),
    ),
    constraints: z.array(z.string()),
  }),
});

type PostContentType = Scalars["BSHBSelect__442379851"];
type PostBusinessGoal = Scalars["BSHBSelect__1319627841"];

// NOTE: These literals MUST stay 1:1 with the Basehub select values for
// Scalars["BSHBSelect__442379851"] in vendor/cms/basehub-types.d.ts.
// If the CMS schema changes, update both this array and the Basehub schema.
const contentTypeValues = [
  "tutorial",
  "announcement",
  "thought-leadership",
  "case-study",
  "comparison",
  "deep-dive",
  "guide",
] as const satisfies PostContentType[];

// NOTE: These literals MUST stay 1:1 with the Basehub select values for
// Scalars["BSHBSelect__1319627841"] in vendor/cms/basehub-types.d.ts.
// If the CMS schema changes, update both this array and the Basehub schema.
const businessGoalValues = [
  "awareness",
  "consideration",
  "conversion",
  "retention",
] as const satisfies PostBusinessGoal[];

// NOTE: postSchema is intentionally a hand-maintained schema that mirrors the
// Basehub blog PostItem shape for the fields we generate via AI.
// Limitations:
// - Zod cannot be derived automatically from the generated TypeScript types in
//   vendor/cms/basehub-types.d.ts; we must keep this schema in sync manually.
// - If the Basehub PostItem schema changes (new/renamed/removed fields or enum
//   values), this schema will need to be updated alongside it.
// - For full, guaranteed 1:1 parity we'd likely introduce codegen to emit Zod
//   schemas from the Basehub schema instead of maintaining this by hand.
export const postSchema = z.object({
  post: z.object({
    title: z.string(),
    slugSuggestion: z.string(),
    description: z.string(),
    excerpt: z.string(),
    content: z.string(),
    contentType: z.enum(contentTypeValues),
    seo: z.object({
      metaTitle: z.string(),
      metaDescription: z.string(),
      focusKeyword: z.string(),
      secondaryKeywords: z.array(z.string()),
      canonicalUrl: z.string().nullable(),
      noIndex: z.boolean(),
    }),
    distribution: z.object({
      businessGoal: z.enum(businessGoalValues),
      primaryProductArea: z.string(),
      targetPersona: z.string(),
      campaignTag: z.string(),
      distributionChannels: distributionChannelsSchema,
    }),
  }),
});

export type AeoPlan = z.infer<typeof aeoPlanSchema>;
export type BlogBrief = z.infer<typeof briefSchema>;
export type BlogPost = z.infer<typeof postSchema>;

const deriveAeoPlanStep = createStep({
  id: "derive-aeo-plan",
  inputSchema: workflowInputSchema,
  outputSchema: workflowInputSchema.extend({
    aeoPlan: aeoPlanSchema,
  }),
  execute: async ({ inputData }) => {
    const prompt = [
      "You are designing an Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO) plan for a single blog post, based on Profound's 10-step GEO guide and 5-step AEO playbook.",
      "",
      "Given:",
      `- rawTopic: ${inputData.rawTopic}`,
      `- businessGoal: ${inputData.businessGoal}`,
      inputData.primaryProductArea
        ? `- primaryProductArea: ${inputData.primaryProductArea}`
        : "",
      inputData.targetPersona
        ? `- targetPersona: ${inputData.targetPersona}`
        : "",
      inputData.campaignTag ? `- campaignTag: ${inputData.campaignTag}` : "",
      inputData.targetQuestions && inputData.targetQuestions.length
        ? `- targetQuestions: ${inputData.targetQuestions.join(" | ")}`
        : "",
      "",
      "Output a compact JSON object with keys: aiVisibilityGoal, funnelStage (top|mid|bottom), targetQuestions (5-10 items), entitiesToHighlight (3-6 items), structuralDirectives (4-8 items).",
      "Focus on real user questions answer engines should be able to answer, entity-anchored definitions, and answer-engine-friendly structure (definition and key takeaways high on the page).",
    ]
      .filter(Boolean)
      .join("\n");

    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-latest"),
      schema: aeoPlanSchema,
      prompt,
    });

    return {
      ...inputData,
      aeoPlan: object,
    };
  },
});

const planBlogBriefStep = createStep({
  id: "plan-blog-brief",
  inputSchema: workflowInputSchema.extend({
    aeoPlan: aeoPlanSchema,
  }),
  outputSchema: workflowInputSchema.extend({
    aeoPlan: aeoPlanSchema,
    brief: briefSchema,
  }),
  execute: async ({ inputData }) => {
    const { aeoPlan, ...rest } = inputData;

    const prompt = [
      "You are the Blog Brief Planner for Lightfast, a memory system built for teams.",
      "",
      "Your job is to create a structured JSON brief for a blog post that will later be written by a separate Blog Writer agent.",
      "",
      "Follow these requirements:",
      "- Align with businessGoal and targetPersona.",
      "- Use AEO/GEO guidance from aeoPlan to choose question-style headings and answer-engine-friendly structure.",
      "- Ensure there is an early definition section (\"What is X?\") and, when relevant, a \"Who is X for?\" or \"When should you use X?\" section.",
      "- Include constraints that keep Lightfast positioned as team memory / neural memory for teams, not as an AEO analytics product.",
      "",
      "Planner input JSON:",
      JSON.stringify(rest, null, 2),
      "",
      "AEO/GEO Plan (aeoPlan):",
      JSON.stringify(aeoPlan, null, 2),
      "",
      "The content of the brief must match this schema exactly.",
    ].join("\n");

    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-latest"),
      schema: briefSchema,
      prompt,
    });

    return {
      ...inputData,
      brief: object,
    };
  },
});

const writeBlogPostStep = createStep({
  id: "write-blog-post",
  inputSchema: workflowInputSchema.extend({
    aeoPlan: aeoPlanSchema,
    brief: briefSchema,
  }),
  outputSchema: z.object({
    aeoPlan: aeoPlanSchema,
    brief: briefSchema,
    post: postSchema,
  }),
  execute: async ({ inputData }) => {
    const { aeoPlan, brief } = inputData;

    const prompt = [
      "You are the Blog Writer for Lightfast, a memory system built for teams.",
      "",
      "Your job is to write a full blog post JSON from a structured brief, ready for CMS ingestion.",
      "",
      "Follow these requirements:",
      "- Write for the targetPersona, aligned with the businessGoal.",
      "- Use answer-engine-friendly structure: strong intro, early definition of the core entity, question-style headings where natural, and a short key-takeaways section when appropriate.",
      "- Use the primary and secondary keywords from the brief in a natural way.",
      "- Lightfast is team memory / neural memory for teams, not an AEO analytics or rankings product.",
      "- Include at least one clear definition block and a CTA section aligned with the businessGoal.",
      "",
      "Brief JSON:",
      JSON.stringify(brief, null, 2),
      "",
      "AEO/GEO Plan:",
      JSON.stringify(aeoPlan, null, 2),
      "",
      "The content of the post must match this schema exactly.",
    ].join("\n");

    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-latest"),
      schema: postSchema,
      prompt,
    });

    return {
      aeoPlan,
      brief,
      post: object,
    };
  },
});

export const lightfastBlogWorkflow = createWorkflow({
  id: "lightfast-blog-post",
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    aeoPlan: aeoPlanSchema,
    brief: briefSchema,
    post: postSchema,
  }),
})
  .then(deriveAeoPlanStep)
  .then(planBlogBriefStep)
  .then(writeBlogPostStep)
  .commit();
