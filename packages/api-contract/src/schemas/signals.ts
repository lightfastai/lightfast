import { z } from "zod";

export const SIGNAL_INPUT_MAX_LENGTH = 4000;
export const SIGNAL_ID_PREFIX = "signal_";

export const signalIdSchema = z
  .string()
  .regex(
    /^signal_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    "Invalid signal id"
  );

export const signalStatusSchema = z.enum([
  "queued",
  "processing",
  "classified",
  "failed",
]);

export const signalDispositionSchema = z.enum([
  "actionable",
  "needs_context",
  "not_actionable",
]);

export const signalKindSchema = z.enum([
  "engage",
  "follow_up",
  "review",
  "fix",
  "investigate",
  "remember",
  "other",
]);

export const signalPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const signalVisibilityScopeSchema = z.enum([
  "user",
  "team",
  "needs_review",
]);

export const signalReviewReasonSchema = z.enum([
  "privacy",
  "sensitive_person",
  "authority",
  "low_confidence",
  "ambiguous_scope",
  "other",
]);

export const signalEntityTargetTypeSchema = z.enum(["person"]);
export const signalEntityMentionKindSchema = z.enum([
  "name",
  "email",
  "handle",
  "profile_url",
]);
export const signalEntityExtractionMethodSchema = z.enum([
  "deterministic",
  "ai",
]);
export const signalEntityLocalEntityKeySchema = z
  .string()
  .regex(/^person_[1-9][0-9]*$/, "Invalid local entity key");
export const signalEntityResolvedPersonSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).nullable(),
  identityProvider: z.enum(["email", "x", "linkedin", "github", "website"]),
  identityType: z.enum(["email", "handle", "profile_url"]),
  identityValue: z.string().min(1),
});
export const signalEntityLinkSchema = z.object({
  targetType: signalEntityTargetTypeSchema,
  localEntityKey: signalEntityLocalEntityKeySchema,
  label: z.string().trim().min(1).max(160),
  mentionKind: signalEntityMentionKindSchema,
  anchorText: z.string().trim().min(1).max(240),
  anchorOccurrence: z.number().int().positive().max(100),
  extractionMethod: signalEntityExtractionMethodSchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  resolvedPerson: signalEntityResolvedPersonSchema.nullable(),
});

export const signalClassificationRouteDecisionSchema = z.object({
  shouldRun: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().trim().min(1),
});

export const signalClassificationRoutingSchema = z.object({
  visibility: z.object({
    scope: signalVisibilityScopeSchema,
    rationale: z.string().trim().min(1),
  }),
  review: z.object({
    required: z.boolean(),
    reason: signalReviewReasonSchema.nullable(),
    rationale: z.string().trim().min(1).nullable(),
  }),
  routes: z
    .object({
      people: signalClassificationRouteDecisionSchema,
    })
    .strict(),
});

const signalClassificationFields = {
  disposition: signalDispositionSchema,
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1),
  kind: signalKindSchema,
  nextAction: z.string().trim().min(1),
  priority: signalPrioritySchema,
  rationale: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  routing: signalClassificationRoutingSchema,
};

const legacySignalClassificationRoutingSchema = z
  .object({
    classifyPeople: z
      .object({
        shouldRun: z.boolean(),
        rationale: z.string().trim().min(1),
      })
      .optional(),
  })
  .optional();

const validateSignalClassificationV2 = (
  value: {
    disposition: z.infer<typeof signalDispositionSchema>;
    routing: z.infer<typeof signalClassificationRoutingSchema>;
  },
  ctx: z.RefinementCtx
) => {
  const { disposition, routing } = value;
  const { visibility, review, routes } = routing;
  const peopleRoute = routes.people;

  if (visibility.scope === "team" && disposition !== "actionable") {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "visibility", "scope"],
      message: "Team visibility requires an actionable disposition",
    });
  }

  if (disposition !== "actionable" && peopleRoute.shouldRun) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "routes", "people", "shouldRun"],
      message: "Non-actionable dispositions cannot run people routing",
    });
  }

  if (peopleRoute.shouldRun && visibility.scope !== "team") {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "routes", "people", "shouldRun"],
      message: "People routing requires team visibility",
    });
  }

  if (visibility.scope === "needs_review") {
    if (!review.required) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "review", "required"],
        message: "Needs-review visibility requires review",
      });
    }

    if (review.reason === null) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "review", "reason"],
        message: "Needs-review visibility requires a review reason",
      });
    }

    if (review.rationale === null) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "review", "rationale"],
        message: "Needs-review visibility requires a review rationale",
      });
    }

    if (peopleRoute.shouldRun) {
      ctx.addIssue({
        code: "custom",
        path: ["routing", "routes", "people", "shouldRun"],
        message: "Needs-review visibility stops people routing",
      });
    }

    return;
  }

  if (review.required) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "review", "required"],
      message: "Visible user and team signals cannot require review",
    });
  }

  if (review.reason !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "review", "reason"],
      message: "Visible user and team signals cannot include a review reason",
    });
  }

  if (review.rationale !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["routing", "review", "rationale"],
      message:
        "Visible user and team signals cannot include a review rationale",
    });
  }
};

const rawSignalClassificationBaseSchema = z
  .object({
    schemaVersion: z.literal("signal.classification.v2"),
    ...signalClassificationFields,
  })
  .strict();

export const signalClassificationSchema =
  rawSignalClassificationBaseSchema.superRefine(validateSignalClassificationV2);

export const signalClassificationBaseSchema = signalClassificationSchema;

export const legacySignalClassificationSchema = z
  .object({
    schemaVersion: z.literal("signal.classification.v1"),
    ...signalClassificationFields,
    routing: legacySignalClassificationRoutingSchema,
  })
  .strict();

export const persistedSignalClassificationSchema = z.union([
  signalClassificationSchema,
  legacySignalClassificationSchema,
]);

export const signalClassificationModelOutputSchema =
  rawSignalClassificationBaseSchema
    .omit({ schemaVersion: true })
    .superRefine(validateSignalClassificationV2);

export function normalizeSignalClassification(
  classification: PersistedSignalClassification
): SignalClassification {
  if (classification.schemaVersion === "signal.classification.v2") {
    return classification;
  }

  const peopleRoute = classification.routing?.classifyPeople;
  const shouldRunPeople =
    classification.disposition === "actionable" &&
    peopleRoute?.shouldRun === true;

  return signalClassificationSchema.parse({
    schemaVersion: "signal.classification.v2",
    disposition: classification.disposition,
    title: classification.title,
    summary: classification.summary,
    kind: classification.kind,
    nextAction: classification.nextAction,
    priority: classification.priority,
    rationale: classification.rationale,
    confidence: classification.confidence,
    routing: {
      visibility: {
        scope: shouldRunPeople ? "team" : "user",
        rationale: shouldRunPeople
          ? "Legacy v1 people routing made this signal team-visible."
          : "Legacy v1 classification did not request team routing.",
      },
      review: {
        required: false,
        reason: null,
        rationale: null,
      },
      routes: {
        people: {
          shouldRun: shouldRunPeople,
          confidence: shouldRunPeople ? classification.confidence : 0,
          rationale:
            peopleRoute?.rationale ??
            "Legacy v1 classification did not include a people routing rationale.",
        },
      },
    },
  });
}

export function normalizePersistedSignalClassification(
  classification: unknown
): SignalClassification | null {
  if (classification === null) {
    return null;
  }
  return normalizeSignalClassification(
    persistedSignalClassificationSchema.parse(classification)
  );
}

export const createSignalInput = z.object({
  input: z.string().trim().min(1).max(SIGNAL_INPUT_MAX_LENGTH),
});

const mcpSignalActorInput = z.object({
  clientId: z.string().min(1),
  grantId: z.string().min(1),
  kind: z.literal("mcp"),
  orgId: z.string().min(1),
  userId: z.string().min(1),
});

export const createMcpSignalCommandInput = z.object({
  actor: mcpSignalActorInput,
  input: createSignalInput.shape.input,
});

export const createSignalOutput = z.object({
  id: signalIdSchema,
  status: z.literal("queued"),
  visibilityScope: z.literal("user"),
});

export const getSignalInput = z.object({
  id: signalIdSchema,
});

export const getMcpSignalCommandInput = z.object({
  actor: mcpSignalActorInput,
  id: getSignalInput.shape.id,
});

export const getSignalOutput = z.object({
  id: signalIdSchema,
  input: z.string(),
  status: signalStatusSchema,
  classification: signalClassificationSchema.nullable(),
  entityLinks: z.array(signalEntityLinkSchema),
  visibilityScope: signalVisibilityScopeSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listSignalsInput = z
  .object({
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    statuses: z.array(signalStatusSchema).max(4).optional(),
  })
  .strict();

export const listSignalsOutputItem = getSignalOutput.omit({
  entityLinks: true,
});

export const listSignalsOutput = z.object({
  items: z.array(listSignalsOutputItem),
  nextCursor: z.string().nullable(),
});

export type SignalVisibilityScope = z.infer<typeof signalVisibilityScopeSchema>;
export type SignalReviewReason = z.infer<typeof signalReviewReasonSchema>;
export type SignalClassification = z.infer<typeof signalClassificationSchema>;
export type LegacySignalClassification = z.infer<
  typeof legacySignalClassificationSchema
>;
export type PersistedSignalClassification = z.infer<
  typeof persistedSignalClassificationSchema
>;
export type SignalClassificationModelOutput = z.infer<
  typeof signalClassificationModelOutputSchema
>;
export type SignalClassificationRouting = z.infer<
  typeof signalClassificationRoutingSchema
>;
export type SignalStatus = z.infer<typeof signalStatusSchema>;
export type SignalEntityLink = z.infer<typeof signalEntityLinkSchema>;
export type SignalEntityResolvedPerson = z.infer<
  typeof signalEntityResolvedPersonSchema
>;
export type CreateSignalInput = z.infer<typeof createSignalInput>;
export type CreateMcpSignalCommandInput = z.infer<
  typeof createMcpSignalCommandInput
>;
export type CreateSignalOutput = z.infer<typeof createSignalOutput>;
export type GetMcpSignalCommandInput = z.infer<typeof getMcpSignalCommandInput>;
export type GetSignalInput = z.infer<typeof getSignalInput>;
export type GetSignalOutput = z.infer<typeof getSignalOutput>;
export type ListSignalsInput = z.infer<typeof listSignalsInput>;
export type ListSignalsOutput = z.infer<typeof listSignalsOutput>;
export type ListSignalsOutputItem = z.infer<typeof listSignalsOutputItem>;
