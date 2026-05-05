import { z } from "zod";

export const buildFlavorSchema = z.enum(["dev", "preview", "prod"]);
export type BuildFlavor = z.infer<typeof buildFlavorSchema>;

export const signingModeSchema = z.enum(["ad-hoc", "developer-id"]);
export type SigningMode = z.infer<typeof signingModeSchema>;

export const buildInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  buildFlavor: buildFlavorSchema,
  buildNumber: z.string(),
  sparkleFeedUrl: z.string(),
  signingMode: signingModeSchema,
});

export type BuildInfo = z.infer<typeof buildInfoSchema>;
