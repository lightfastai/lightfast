/**
 * URL Resolver for Neural Memory
 *
 * Resolves external URLs (GitHub, Linear, etc.) to internal content IDs.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations, workspaceKnowledgeDocuments } from "@db/console/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export interface ResolvedContent {
  id: string;
  type: "observation" | "document";
}

/**
 * Parse GitHub URL into components.
 */
interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  type: "pr" | "issue" | "commit" | "release" | "discussion" | "file";
  identifier: string;
}

const URL_PATTERNS = [
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
    type: "pr" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
    type: "issue" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/commit\/([a-f0-9]+)/,
    type: "commit" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/tag\/(.+)/,
    type: "release" as const,
  },
  {
    regex: /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/discussions\/(\d+)/,
    type: "discussion" as const,
  },
] as const;

function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  for (const { regex, type } of URL_PATTERNS) {
    const match = regex.exec(url);
    if (match?.[1] && match[2] && match[3]) {
      return {
        owner: match[1],
        repo: match[2],
        type,
        identifier: match[3],
      };
    }
  }
  return null;
}

/**
 * Build sourceId candidates from parsed URL.
 * URLs don't indicate action state, so we query all variants.
 */
function buildSourceIdCandidates(parsed: ParsedGitHubUrl): string[] {
  const repoPath = `${parsed.owner}/${parsed.repo}`;

  switch (parsed.type) {
    case "pr":
      return [
        `pr:${repoPath}#${parsed.identifier}:merged`,
        `pr:${repoPath}#${parsed.identifier}:closed`,
        `pr:${repoPath}#${parsed.identifier}:opened`,
        `pr:${repoPath}#${parsed.identifier}:reopened`,
      ];
    case "issue":
      return [
        `issue:${repoPath}#${parsed.identifier}:closed`,
        `issue:${repoPath}#${parsed.identifier}:opened`,
        `issue:${repoPath}#${parsed.identifier}:reopened`,
      ];
    case "commit":
      return [`push:${repoPath}:${parsed.identifier}`];
    case "release":
      return [
        `release:${repoPath}:${parsed.identifier}:published`,
        `release:${repoPath}:${parsed.identifier}:created`,
      ];
    case "discussion":
      return [`discussion:${repoPath}#${parsed.identifier}`];
    default:
      return [];
  }
}

/**
 * Resolve a URL to an internal content ID.
 *
 * Uses indexed sourceId lookup for efficient resolution.
 */
export async function resolveByUrl(
  workspaceId: string,
  url: string
): Promise<ResolvedContent | null> {
  // Parse GitHub URL
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return null;
  }

  const sourceIdCandidates = buildSourceIdCandidates(parsed);
  if (sourceIdCandidates.length === 0) {
    return null;
  }

  // Query observations using indexed sourceId lookup
  const observation = await db.query.workspaceNeuralObservations.findFirst({
    columns: { id: true },
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      inArray(workspaceNeuralObservations.sourceId, sourceIdCandidates)
    ),
    orderBy: [desc(workspaceNeuralObservations.occurredAt)],
  });

  if (observation) {
    return { id: observation.id, type: "observation" };
  }

  // For file URLs, check documents table
  if (parsed.type === "file") {
    const document = await db.query.workspaceKnowledgeDocuments.findFirst({
      columns: { id: true },
      where: and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.sourceType, "github"),
        eq(workspaceKnowledgeDocuments.sourceId, parsed.identifier)
      ),
    });

    if (document) {
      return { id: document.id, type: "document" };
    }
  }

  return null;
}
