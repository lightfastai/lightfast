import { z } from "zod";

export const createOrgApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  secondsUntilExpiration: z.number().int().positive().optional(),
});

export const revokeOrgApiKeySchema = z.object({
  keyId: z.string().min(1),
  revocationReason: z.string().max(200).optional(),
});

export const deleteOrgApiKeySchema = z.object({
  keyId: z.string().min(1),
});
