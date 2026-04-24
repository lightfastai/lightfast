import { z } from "zod";

export const buildFlavorSchema = z.enum(["dev", "preview", "prod"]);
export type BuildFlavor = z.infer<typeof buildFlavorSchema>;

export const buildInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  buildFlavor: buildFlavorSchema,
  buildNumber: z.string(),
  sparkleFeedUrl: z.string(),
});

export type BuildInfo = z.infer<typeof buildInfoSchema>;
