import { z } from "zod";

export const resourceTypeSchema = z.enum(["image", "video", "audio", "text"]);
export const createTextResourceSchema = z.object({
  prompt: z.string(),
});

export const generateResourceSchema = z.object({
  resourceType: resourceTypeSchema,
  prompt: z.string(),
});

export const createResourceSpecificSchema = z.object({
  prompt: z.string(),
  id: z.string(),
});

export type CreateResourceSpecificInput = z.infer<
  typeof createResourceSpecificSchema
>;
