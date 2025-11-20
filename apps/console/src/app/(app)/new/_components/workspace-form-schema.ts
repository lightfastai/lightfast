import { z } from "zod";

/**
 * Workspace Creation Form Schema
 *
 * Validation rules:
 * - Organization: Required
 * - Workspace name: 3-50 chars, lowercase alphanumeric + hyphens only
 * - Repository: Optional (handled separately in GitHub connector)
 */
export const workspaceFormSchema = z.object({
  organizationId: z.string().min(1, "Please select an organization"),
  workspaceName: z
    .string()
    .min(3, "Workspace name must be at least 3 characters")
    .max(50, "Workspace name must be less than 50 characters")
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

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;
