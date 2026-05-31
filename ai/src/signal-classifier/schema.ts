import { signalClassificationModelOutputSchema } from "@repo/api-contract";

// `schemaVersion` is a fixed, code-owned literal. The model owns only the
// classification fields; runtime code stamps the schema version after parsing.
//
// The model-facing schema still enforces the v2 routing invariants so invalid
// visibility/route combinations fail before persistence.
export const signalClassificationModelSchema =
  signalClassificationModelOutputSchema;
