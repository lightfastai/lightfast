/**
 * Workspace Form Schemas
 *
 * Client-side validation schemas for workspace-related forms.
 * Used with React Hook Form + zodResolver.
 */

import { z } from "zod";
import { workspaceCreateInputSchema, workspaceUpdateNameInputSchema } from "../schemas/workspace";
import { workspaceNameSchema } from "../primitives/slugs";

/**
 * Workspace Creation Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/new/page.tsx
 *
 * @example
 * ```typescript
 * const form = useForm<WorkspaceFormValues>({
 *   resolver: zodResolver(workspaceFormSchema),
 *   defaultValues: { organizationId: "", workspaceName: "" },
 * });
 * ```
 */
export const workspaceFormSchema = workspaceCreateInputSchema.extend({
  // Rename clerkOrgId to organizationId for form field naming
  organizationId: z.string().min(1, "Please select an organization"),
}).omit({ clerkOrgId: true });

export type WorkspaceFormValues = z.infer<typeof workspaceFormSchema>;

/**
 * Workspace Settings Form Schema
 *
 * Used in:
 * - /apps/console/src/app/(app)/[slug]/[workspaceName]/settings/page.tsx
 *
 * Only validates the new workspace name (current name is for reference)
 *
 * @example
 * ```typescript
 * const form = useForm<WorkspaceSettingsFormValues>({
 *   resolver: zodResolver(workspaceSettingsFormSchema),
 *   defaultValues: { workspaceName: currentWorkspace.name },
 * });
 * ```
 */
export const workspaceSettingsFormSchema = z.object({
  workspaceName: workspaceNameSchema,
});

export type WorkspaceSettingsFormValues = z.infer<
  typeof workspaceSettingsFormSchema
>;
