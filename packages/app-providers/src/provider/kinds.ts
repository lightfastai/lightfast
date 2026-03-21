import { z } from "zod";

// ── Provider Kind + Auth Kind (Zod enums — anchor discriminant literals) ─────
// Factories use `satisfies z.infer<typeof providerKindSchema>` so adding or
// removing a kind from this enum causes a compile-time error in the factory.

export const providerKindSchema = z.enum(["webhook", "managed", "api"]);
export type ProviderKind = z.infer<typeof providerKindSchema>;

export const authKindSchema = z.enum(["oauth", "api-key", "app-token"]);
export type AuthKind = z.infer<typeof authKindSchema>;

export const categoryDefSchema = z.object({
  description: z.string(),
  label: z.string(),
  type: z.enum(["observation", "sync+observation"]),
});
export type CategoryDef = z.infer<typeof categoryDefSchema>;

/** Per-action sub-event definition (e.g., "opened", "merged" for pull_request) */
export const actionDefSchema = z.object({
  label: z.string(),
  weight: z.number(),
});
export type ActionDef = z.infer<typeof actionDefSchema>;
