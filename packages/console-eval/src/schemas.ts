import { z } from "zod";
import { sourceTypeSchema } from "@repo/console-validation";

// --- Source Actor schema (mirrors SourceActor from console-types) ---
export const seedActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
});

// --- Source Reference schema (mirrors SourceReference from console-types) ---
export const seedReferenceSchema = z.object({
  type: z.enum([
    "commit", "branch", "pr", "issue", "deployment",
    "project", "cycle", "assignee", "reviewer", "team", "label",
  ]),
  id: z.string().min(1),
  url: z.string().optional(),
  label: z.string().optional(),
});

export const seedObservationSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  source: sourceTypeSchema,
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  observationType: z.string().min(1),
  occurredAt: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  entities: z
    .array(
      z.object({
        category: z.string().min(1),
        key: z.string().min(1),
        value: z.string().optional(),
      }),
    )
    .optional(),
  embedding: z.array(z.number()).optional(),
  actor: seedActorSchema.optional(),
  references: z.array(seedReferenceSchema).optional(),
});

export const seedCorpusSchema = z.object({
  observations: z.array(seedObservationSchema),
});

export const evalInfraConfigSchema = z.object({
  db: z.object({
    host: z.string().min(1),
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  pinecone: z.object({
    apiKey: z.string().min(1),
  }),
  cohere: z.object({
    apiKey: z.string().min(1),
  }),
  braintrust: z
    .object({
      apiKey: z.string().min(1),
    })
    .optional(),
});

export type SeedObservation = z.infer<typeof seedObservationSchema>;
export type SeedCorpus = z.infer<typeof seedCorpusSchema>;
export type SeedActor = z.infer<typeof seedActorSchema>;
export type SeedReference = z.infer<typeof seedReferenceSchema>;
