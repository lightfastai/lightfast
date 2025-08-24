import { z } from "zod";

const $Audience = z.enum(["early-access"]);
type Audience = z.infer<typeof $Audience>;

export const RESEND_AUDIENCES_ID_MAPPING: Record<Audience, string> = {
  "early-access": "566b084b-5177-40ca-b765-bf9860dda513",
} as const;
