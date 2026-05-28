import { z } from "zod";

const cursorCreatedAtSchema = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((value) => new Date(value)),
]);

export const workspaceListCursorInput = z
  .object({
    createdAt: cursorCreatedAtSchema,
    id: z.number().int().positive(),
  })
  .nullish();

export const workspaceListLimitInput = z
  .number()
  .int()
  .min(1)
  .max(100)
  .optional();

export const workspaceListSearchInput = z
  .string()
  .trim()
  .max(200)
  .transform((value) => value || undefined)
  .optional();
