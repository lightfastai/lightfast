/**
 * Extract cross-source relationships workflow
 *
 * Extracts relationships between documents from different sources:
 * - GitHub PR → Linear Issue (e.g., "Closes LIN-123")
 * - Linear Issue → GitHub PR (e.g., PR link in description)
 * - Notion → GitHub (e.g., PR links in docs)
 * - Sentry → GitHub (e.g., commits in error)
 *
 * Stores relationships in JSONB for flexible querying and graph traversal
 */

import { db } from "@db/console/client";
import { docsDocuments } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../../client/client";
import { log } from "@vendor/observability/log";

/**
 * Relationship types supported
 */
export type RelationType =
  | "resolves" // GitHub PR resolves Linear issue
  | "references" // Generic reference/mention
  | "duplicates" // Sentry issue duplicates another
  | "depends_on" // Document depends on another
  | "child_of" // Hierarchical relationship
  | "deployed_by"; // Vercel deployment deployed by GitHub commit

/**
 * Relationship structure
 */
export interface Relationship {
  type: RelationType;
  sourceType: string;
  sourceId: string;
  targetType?: string;
  targetId?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Relationship extraction event
 */
export interface ExtractRelationshipsEvent {
  documentId: string;
  storeSlug: string;
  workspaceId: string;
  sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
  relationships: Record<string, unknown>;
}

/**
 * Extract relationships workflow
 *
 * Parses document content and metadata to extract cross-source relationships
 */
export const extractRelationships = inngest.createFunction(
  {
    id: "apps-console/extract-relationships",
    name: "Extract Cross-Source Relationships",
    description: "Extracts and stores relationships between documents",
    retries: 2,

    // Prevent duplicate extraction
    idempotency: 'event.data.documentId + "-relationships"',
  },
  { event: "apps-console/relationships.extract" },
  async ({ event, step }) => {
    const { documentId, sourceType, relationships } = event.data;

    log.info("Extracting relationships", {
      documentId,
      sourceType,
      relationshipCount: Object.keys(relationships).length,
    });

    const extractedRelationships = await step.run(
      "parse-relationships",
      async () => {
        try {
          const parsed: Relationship[] = [];

          // Parse relationships based on source type
          switch (sourceType) {
            case "github":
              parsed.push(...parseGitHubRelationships(relationships));
              break;
            case "linear":
              parsed.push(...parseLinearRelationships(relationships));
              break;
            case "notion":
              parsed.push(...parseNotionRelationships(relationships));
              break;
            case "sentry":
              parsed.push(...parseSentryRelationships(relationships));
              break;
            case "vercel":
              parsed.push(...parseVercelRelationships(relationships));
              break;
            case "zendesk":
              parsed.push(...parseZendeskRelationships(relationships));
              break;
          }

          log.info("Parsed relationships", {
            documentId,
            extractedCount: parsed.length,
          });

          return parsed;
        } catch (error) {
          log.error("Failed to parse relationships", {
            error,
            documentId,
            sourceType,
          });
          return [];
        }
      },
    );

    if (extractedRelationships.length === 0) {
      log.info("No relationships extracted", { documentId });
      return { status: "skipped", reason: "no_relationships" };
    }

    // Store relationships in document
    await step.run("store-relationships", async () => {
      try {
        await db
          .update(docsDocuments)
          .set({
            relationships: {
              extracted: extractedRelationships,
              extractedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(docsDocuments.id, documentId));

        log.info("Stored relationships", {
          documentId,
          count: extractedRelationships.length,
        });
      } catch (error) {
        log.error("Failed to store relationships", {
          error,
          documentId,
        });
        throw error;
      }
    });

    return {
      status: "processed",
      documentId,
      relationshipCount: extractedRelationships.length,
    };
  },
);

/**
 * Parse GitHub relationships
 * Examples: "Closes #123", "Fixes LIN-456", "Resolves ISSUE-789"
 */
function parseGitHubRelationships(
  relationships: Record<string, unknown>,
): Relationship[] {
  const parsed: Relationship[] = [];

  // Extract Linear issue references (e.g., "Closes LIN-123")
  const linearPattern = /\b(LIN|TEAM)-\d+\b/gi;
  const content = JSON.stringify(relationships);
  const linearMatches = content.match(linearPattern) || [];

  for (const match of linearMatches) {
    parsed.push({
      type: "resolves",
      sourceType: "github",
      sourceId: "", // Filled in by caller
      targetType: "linear",
      targetId: match,
    });
  }

  // Extract GitHub issue references (e.g., "Closes #123")
  const githubPattern = /#(\d+)\b/g;
  const githubMatches = content.match(githubPattern) || [];

  for (const match of githubMatches) {
    parsed.push({
      type: "resolves",
      sourceType: "github",
      sourceId: "",
      targetType: "github",
      targetId: match.replace("#", ""),
    });
  }

  return parsed;
}

/**
 * Parse Linear relationships
 * Examples: PR links, GitHub commit references
 */
function parseLinearRelationships(
  relationships: Record<string, unknown>,
): Relationship[] {
  const parsed: Relationship[] = [];

  // Extract GitHub PR URLs
  const prPattern =
    /https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/gi;
  const content = JSON.stringify(relationships);
  const prMatches = [...content.matchAll(prPattern)];

  for (const match of prMatches) {
    const [url, owner, repo, prNumber] = match;
    parsed.push({
      type: "references",
      sourceType: "linear",
      sourceId: "",
      targetType: "github",
      targetId: `${owner}/${repo}#${prNumber}`,
      url,
    });
  }

  return parsed;
}

/**
 * Parse Notion relationships
 * Examples: GitHub links, Linear issue links
 */
function parseNotionRelationships(
  relationships: Record<string, unknown>,
): Relationship[] {
  const parsed: Relationship[] = [];

  const content = JSON.stringify(relationships);

  // Extract GitHub URLs
  const githubPattern =
    /https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:pull|issues)\/(\d+)/gi;
  const githubMatches = [...content.matchAll(githubPattern)];

  for (const match of githubMatches) {
    const [url, owner, repo, number] = match;
    parsed.push({
      type: "references",
      sourceType: "notion",
      sourceId: "",
      targetType: "github",
      targetId: `${owner}/${repo}#${number}`,
      url,
    });
  }

  // Extract Linear URLs
  const linearPattern = /https:\/\/linear\.app\/([^/]+)\/issue\/([^/\s]+)/gi;
  const linearMatches = [...content.matchAll(linearPattern)];

  for (const match of linearMatches) {
    const [url, team, issueId] = match;
    parsed.push({
      type: "references",
      sourceType: "notion",
      sourceId: "",
      targetType: "linear",
      targetId: issueId,
      url,
    });
  }

  return parsed;
}

/**
 * Parse Sentry relationships
 * Examples: commit references, GitHub PR links
 */
function parseSentryRelationships(
  relationships: Record<string, unknown>,
): Relationship[] {
  const parsed: Relationship[] = [];

  // Extract commit SHAs
  if (
    "commits" in relationships &&
    Array.isArray(relationships.commits)
  ) {
    for (const commit of relationships.commits) {
      if (typeof commit === "object" && commit && "id" in commit) {
        parsed.push({
          type: "references",
          sourceType: "sentry",
          sourceId: "",
          targetType: "github",
          targetId: String(commit.id).substring(0, 7),
          metadata: commit as Record<string, unknown>,
        });
      }
    }
  }

  return parsed;
}

/**
 * Parse Vercel relationships
 * Examples: GitHub commit SHA, PR number
 */
function parseVercelRelationships(
  relationships: Record<string, unknown>,
): Relationship[] {
  const parsed: Relationship[] = [];

  // Extract commit SHA
  if ("commitSha" in relationships && relationships.commitSha) {
    parsed.push({
      type: "deployed_by",
      sourceType: "vercel",
      sourceId: "",
      targetType: "github",
      targetId: String(relationships.commitSha).substring(0, 7),
    });
  }

  // Extract PR number
  if ("prNumber" in relationships && relationships.prNumber) {
    parsed.push({
      type: "deployed_by",
      sourceType: "vercel",
      sourceId: "",
      targetType: "github",
      targetId: `#${relationships.prNumber}`,
    });
  }

  return parsed;
}

/**
 * Parse Zendesk relationships
 * Examples: GitHub issue links, Linear issue links
 */
function parseZendeskRelationships(
  relationships: Record<string, unknown>,
): Relationship[] {
  const parsed: Relationship[] = [];

  const content = JSON.stringify(relationships);

  // Extract GitHub issue URLs
  const githubPattern =
    /https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/gi;
  const githubMatches = [...content.matchAll(githubPattern)];

  for (const match of githubMatches) {
    const [url, owner, repo, issueNumber] = match;
    parsed.push({
      type: "references",
      sourceType: "zendesk",
      sourceId: "",
      targetType: "github",
      targetId: `${owner}/${repo}#${issueNumber}`,
      url,
    });
  }

  return parsed;
}
