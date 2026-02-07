import { z } from "zod";

export const seedObservationSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().min(1),
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
