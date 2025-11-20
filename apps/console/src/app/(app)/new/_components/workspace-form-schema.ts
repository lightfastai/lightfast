import { z } from "zod";
import {
  WORKSPACE_NAME,
  NAMING_ERRORS,
} from "@db/console/constants/naming";

/**
 * Workspace Creation Form Schema
 *
 * Validation rules:
 * - Organization: Required
 * - Workspace name: 3-20 chars (Pinecone index constraint)
 * - Letters, numbers, and hyphens only (mixed case allowed)
 * - Repository: Optional (handled separately in GitHub connector)
 */
export const workspaceFormSchema = z.object({
  organizationId: z.string().min(1, "Please select an organization"),
  workspaceName: z
    .string()
    .min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
    .max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
    .regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN),
});

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;
