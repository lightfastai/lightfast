import type { Source } from "~/types";

export function getResourceLabel(metadata: Source["metadata"]): string {
	switch (metadata.sourceType) {
		case "github": return metadata.repoFullName;
		case "vercel": return metadata.projectName;
		case "linear": return metadata.teamName;
		case "sentry": return metadata.projectSlug;
	}
}
