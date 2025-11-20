import { z } from "zod";

/**
 * Team Creation Form Schema
 *
 * Validation rules:
 * - Team name: 3-50 chars, lowercase alphanumeric + hyphens only
 * - Must start and end with letter or number
 * - Cannot contain consecutive hyphens
 */
export const teamFormSchema = z.object({
  teamName: z
    .string()
    .min(3, "Team name must be at least 3 characters")
    .max(50, "Team name must be less than 50 characters")
    .regex(
      /^[a-z0-9-]+$/,
      "Only lowercase letters, numbers, and hyphens are allowed"
    )
    .regex(/^[a-z0-9]/, "Must start with a letter or number")
    .regex(/[a-z0-9]$/, "Must end with a letter or number")
    .refine((val) => !val.includes("--"), {
      message: "Cannot contain consecutive hyphens",
    }),
});

export type TeamFormValues = z.infer<typeof teamFormSchema>;
