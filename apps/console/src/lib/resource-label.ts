import type { Source } from "~/types";

export function getResourceLabel(metadata: Source["metadata"]): string {
  switch (metadata.sourceType) {
    case "github":
      return metadata.repoId;
    case "vercel":
      return metadata.projectId;
    case "linear":
      return metadata.teamId;
    case "sentry":
      return metadata.projectId;
  }
}
