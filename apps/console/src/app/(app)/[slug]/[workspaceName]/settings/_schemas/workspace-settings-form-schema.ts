import { z } from "zod";
import {
	WORKSPACE_NAME,
	NAMING_ERRORS,
} from "@db/console/constants/naming";

/**
 * Workspace Settings Form Schema
 *
 * Validation rules for updating workspace settings:
 * - Workspace name: 1-100 chars (GitHub repo naming rules)
 * - Letters, numbers, hyphens (-), periods (.), and underscores (_) only
 * - Used in URLs: /{orgSlug}/{workspaceName}
 */
export const workspaceSettingsFormSchema = z.object({
	workspaceName: z
		.string()
		.min(WORKSPACE_NAME.MIN_LENGTH, NAMING_ERRORS.WORKSPACE_MIN_LENGTH)
		.max(WORKSPACE_NAME.MAX_LENGTH, NAMING_ERRORS.WORKSPACE_MAX_LENGTH)
		.regex(WORKSPACE_NAME.PATTERN, NAMING_ERRORS.WORKSPACE_PATTERN),
});

export type WorkspaceSettingsFormValues = z.infer<
	typeof workspaceSettingsFormSchema
>;
