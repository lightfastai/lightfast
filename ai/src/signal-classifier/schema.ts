import { signalClassificationSchema } from "@repo/api-contract";
import { z } from "zod";

// `schemaVersion` is a fixed, code-owned literal. The model owns only the
// classification fields; runtime code stamps the schema version after parsing.
//
// OpenAI strict structured outputs require every object property to be listed in
// `required`. The public API keeps routing optional for backwards compatibility,
// but the model-facing schema always asks for the routing decision.
export const signalClassificationModelSchema = signalClassificationSchema
  .omit({
    schemaVersion: true,
    routing: true,
  })
  .extend({
    routing: z.object({
      classifyPeople: z.object({
        shouldRun: z.boolean(),
        rationale: z.string().trim().min(1),
      }),
    }),
  });
