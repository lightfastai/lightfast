import { z } from "zod";

export const DEVELOPER_CONNECTION_PROVIDERS = [
  "pscale",
  "upstash",
  "sentry",
  "clerk",
] as const;
export const developerConnectionProviderSchema = z.enum(
  DEVELOPER_CONNECTION_PROVIDERS
);
export type DeveloperConnectionProvider = z.infer<
  typeof developerConnectionProviderSchema
>;

export const developerConnectionStatusSchema = z.enum([
  "connected",
  "needs_reconnect",
  "revoked",
  "replaced",
]);
export type DeveloperConnectionStatus = z.infer<
  typeof developerConnectionStatusSchema
>;

export const developerConnectionCredentialKindSchema = z.enum([
  "pscale_service_token",
  "upstash_management_key",
  "sentry_token",
  "sentry_oauth_token",
  "clerk_instance_secret",
]);
export type DeveloperConnectionCredentialKind = z.infer<
  typeof developerConnectionCredentialKindSchema
>;

export const developerConnectionLeaseStatusSchema = z.enum([
  "issued",
  "materialized",
  "revoked",
  "expired",
  "failed",
]);
export type DeveloperConnectionLeaseStatus = z.infer<
  typeof developerConnectionLeaseStatusSchema
>;

export const developerConnectionCatalogStatusSchema = z.enum([
  "available",
  "coming_soon",
]);
export type DeveloperConnectionCatalogStatus = z.infer<
  typeof developerConnectionCatalogStatusSchema
>;

export const developerConnectionUnavailableReasonSchema = z.enum([
  "coming_soon",
  "permission_required",
]);
export type DeveloperConnectionUnavailableReason = z.infer<
  typeof developerConnectionUnavailableReasonSchema
>;

export const DEVELOPER_CONNECTION_CATALOG = [
  {
    provider: "pscale",
    displayName: "PlanetScale",
    description: "Provision and inspect PlanetScale development databases.",
    builder: "Lightfast",
    category: "Database",
    catalogStatus: "available",
  },
  {
    provider: "upstash",
    displayName: "Upstash",
    description: "Provision and inspect Upstash Redis development resources.",
    builder: "Lightfast",
    category: "Infrastructure",
    catalogStatus: "available",
  },
  {
    provider: "sentry",
    displayName: "Sentry",
    description: "Inspect Sentry issues and manage release artifacts.",
    builder: "Lightfast",
    category: "Observability",
    catalogStatus: "available",
  },
  {
    provider: "clerk",
    displayName: "Clerk",
    description: "Inspect and manage a connected Clerk instance.",
    builder: "Lightfast",
    category: "Authentication",
    catalogStatus: "available",
  },
] as const satisfies ReadonlyArray<{
  provider: DeveloperConnectionProvider;
  displayName: string;
  description: string;
  builder: "Lightfast";
  category: string;
  catalogStatus: DeveloperConnectionCatalogStatus;
}>;

export const developerConnectionProviderInputSchema = z.object({
  provider: developerConnectionProviderSchema,
});

const providerAccountNameSchema = z.string().trim().min(1).max(128);

export const developerConnectionConnectInputSchema = z.discriminatedUnion(
  "provider",
  [
    z.object({
      provider: z.literal("pscale"),
      providerAccountName: providerAccountNameSchema,
      serviceTokenId: z.string().trim().min(1),
      serviceToken: z.string().trim().min(1),
    }),
    z.object({
      provider: z.literal("upstash"),
      providerAccountName: providerAccountNameSchema,
      email: z.string().trim().email(),
      apiKey: z.string().trim().min(1),
    }),
    z.object({
      provider: z.literal("sentry"),
      providerAccountName: providerAccountNameSchema,
      token: z.string().trim().min(1),
    }),
    z.object({
      provider: z.literal("clerk"),
      providerAccountName: providerAccountNameSchema,
      appId: z.string().trim().min(1),
      instanceId: z.string().trim().min(1),
      secretKey: z.string().trim().min(1),
    }),
  ]
);
export type DeveloperConnectionConnectInput = z.infer<
  typeof developerConnectionConnectInputSchema
>;

export const developerConnectionStartAuthInputSchema = z.object({
  provider: z.literal("sentry"),
  providerAccountName: providerAccountNameSchema,
});
export type DeveloperConnectionStartAuthInput = z.infer<
  typeof developerConnectionStartAuthInputSchema
>;

export const developerConnectionCompleteAuthInputSchema = z.object({
  provider: z.literal("sentry"),
  attemptId: z.string().trim().min(1).max(128),
});
export type DeveloperConnectionCompleteAuthInput = z.infer<
  typeof developerConnectionCompleteAuthInputSchema
>;

export const developerConnectionSetSandboxEnabledInputSchema = z.object({
  provider: developerConnectionProviderSchema,
  enabled: z.boolean(),
});
export type DeveloperConnectionSetSandboxEnabledInput = z.infer<
  typeof developerConnectionSetSandboxEnabledInputSchema
>;

export const developerConnectionIssueLeaseInputSchema = z.object({
  providers: z
    .array(developerConnectionProviderSchema)
    .min(1)
    .max(DEVELOPER_CONNECTION_PROVIDERS.length)
    .refine(
      (providers) => new Set(providers).size === providers.length,
      "Providers must be unique"
    ),
  sandboxRunId: z.string().trim().min(1).max(128),
  workflowRunId: z.string().trim().min(1).max(128),
});
export type DeveloperConnectionIssueLeaseInput = z.infer<
  typeof developerConnectionIssueLeaseInputSchema
>;
