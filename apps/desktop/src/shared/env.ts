import { z } from "zod";

export const buildFlavorSchema = z.enum(["dev", "preview", "prod"]);
export type BuildFlavor = z.infer<typeof buildFlavorSchema>;

export const buildInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  buildFlavor: buildFlavorSchema,
  buildNumber: z.string(),
  sparkleFeedUrl: z.string(),
  sparklePublicKey: z.string(),
});

export type BuildInfo = z.infer<typeof buildInfoSchema>;

export const runtimeEnvSchema = z.object({
  SENTRY_DSN: z.string().url().optional(),
  SPARKLE_FEED_URL: z.string().url().optional(),
  SQUIRREL_FEED_URL: z.string().url().optional(),
  BUILD_FLAVOR: buildFlavorSchema.optional(),
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function parseRuntimeEnv(
  env: Record<string, string | undefined>
): RuntimeEnv {
  const result = runtimeEnvSchema.safeParse(env);
  return result.success ? result.data : {};
}
