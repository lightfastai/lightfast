import { z } from "zod";

/**
 * GitHub source metadata
 *
 * Metadata for GitHub repositories connected as sources.
 */
export const githubSourceMetadataSchema = z.object({
  repoId: z.string(),
  repoFullName: z.string(),
  defaultBranch: z.string(),
  installationId: z.string(),
  isPrivate: z.boolean(),
});

export type GitHubSourceMetadata = z.infer<typeof githubSourceMetadataSchema>;

// Future source metadata schemas:
// - Linear (teamId, teamName)
// - Notion (workspaceId, workspaceName)
// - Sentry (organizationSlug, projectSlug)
