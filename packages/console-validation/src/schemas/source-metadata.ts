import { z } from "zod";

// GitHub source metadata
export const githubSourceMetadataSchema = z.object({
  repoId: z.string(),
  repoFullName: z.string(),
  defaultBranch: z.string(),
  installationId: z.string(),
  isPrivate: z.boolean(),
});

// Linear source metadata (future)
export const linearSourceMetadataSchema = z.object({
  teamId: z.string(),
  teamName: z.string(),
});

export type GitHubSourceMetadata = z.infer<typeof githubSourceMetadataSchema>;
export type LinearSourceMetadata = z.infer<typeof linearSourceMetadataSchema>;
