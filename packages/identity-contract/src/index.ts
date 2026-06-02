import { z } from "zod";

export const IDENTITY_FILE_NAMES = {
  identity: "IDENTITY.md",
  soul: "SOUL.md",
} as const;

export const IDENTITY_FILE_KINDS = ["identity", "soul"] as const;

export const IDENTITY_FILE_STATUSES = [
  "present",
  "missing",
  "too_large",
  "read_error",
] as const;

export const IDENTITY_CONTEXT_SURFACES = ["signal", "chat", "agent"] as const;

export const IDENTITY_INDEX_REFRESH_STATUSES = [
  "never",
  "fresh",
  "stale",
  "refreshing",
  "failed",
] as const;

export const IDENTITY_WATCHED_PATH_GLOBS = [
  "skills/**",
  IDENTITY_FILE_NAMES.identity,
  IDENTITY_FILE_NAMES.soul,
] as const;

export const IDENTITY_INDEX_MAX_CHARS_PER_FILE = 20_000;
export const SIGNAL_IDENTITY_CONTEXT_MAX_CHARS = 4000;

export const identityFileKindSchema = z.enum(IDENTITY_FILE_KINDS);
export type IdentityFileKind = z.infer<typeof identityFileKindSchema>;

export const identityFileStatusSchema = z.enum(IDENTITY_FILE_STATUSES);
export type IdentityFileStatus = z.infer<typeof identityFileStatusSchema>;

export const identityContextSurfaceSchema = z.enum(IDENTITY_CONTEXT_SURFACES);
export type IdentityContextSurface = z.infer<
  typeof identityContextSurfaceSchema
>;

export const identityIndexRefreshStatusSchema = z.enum(
  IDENTITY_INDEX_REFRESH_STATUSES
);
export type IdentityIndexRefreshStatus = z.infer<
  typeof identityIndexRefreshStatusSchema
>;

export const identityContextProvenanceSchema = z.object({
  surface: identityContextSurfaceSchema,
  includedFiles: z.array(
    z.object({
      kind: identityFileKindSchema,
      path: z.string(),
      status: identityFileStatusSchema,
      contentHash: z.string().nullable(),
      commitSha: z.string().nullable(),
    })
  ),
  diagnostics: z.array(z.string()),
  systemSectionHash: z.string().nullable(),
});
export type IdentityContextProvenance = z.infer<
  typeof identityContextProvenanceSchema
>;

export const signalClassificationMetadataSchema = z.object({
  organizationIdentity: identityContextProvenanceSchema.optional(),
});
export type SignalClassificationMetadata = z.infer<
  typeof signalClassificationMetadataSchema
>;
