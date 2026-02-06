 

import { db } from "@db/console/client";
import { workspaceKnowledgeDocuments } from "@db/console/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import type { V1ContentsResponse, V1ContentItem } from "@repo/console-types";
import { recordSystemActivity } from "@api/console/lib/activity";

import { buildSourceUrl } from "~/lib/neural/url-builder";
import { resolveObservationsById } from "~/lib/neural/id-resolver";
import type { ResolvedObservation } from "~/lib/neural/id-resolver";
import type { V1AuthContext } from "./index";

export interface ContentsLogicInput {
  ids: string[];
  requestId: string;
}

export type ContentsLogicOutput = V1ContentsResponse;

export async function contentsLogic(
  auth: V1AuthContext,
  input: ContentsLogicInput,
): Promise<ContentsLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/contents logic executing", { requestId: input.requestId, idCount: input.ids.length });

  // Separate IDs by type
  const docIds = input.ids.filter((id) => id.startsWith("doc_"));
  const obsIds = input.ids.filter((id) => !id.startsWith("doc_"));

  // Fetch in parallel
  const [observationMap, documents] = await Promise.all([
    obsIds.length > 0
      ? resolveObservationsById(auth.workspaceId, obsIds, {
          id: true,
          title: true,
          content: true,
          source: true,
          sourceId: true,
          observationType: true,
          occurredAt: true,
          metadata: true,
        })
      : Promise.resolve(new Map<string, ResolvedObservation>()),

    docIds.length > 0
      ? db
          .select({
            id: workspaceKnowledgeDocuments.id,
            sourceType: workspaceKnowledgeDocuments.sourceType,
            sourceId: workspaceKnowledgeDocuments.sourceId,
            sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
          })
          .from(workspaceKnowledgeDocuments)
          .where(
            and(
              eq(workspaceKnowledgeDocuments.workspaceId, auth.workspaceId),
              inArray(workspaceKnowledgeDocuments.id, docIds)
            )
          )
      : Promise.resolve([]),
  ]);

  // Map to response format
  const items: V1ContentItem[] = [
    // Observations
    ...Array.from(observationMap.entries()).map(([reqId, obs]) => {
      const metadata = obs.metadata ?? {};
      return {
        id: reqId,
        title: obs.title,
        url: buildSourceUrl(obs.source, obs.sourceId, metadata),
        snippet: obs.content.slice(0, 200),
        content: obs.content,
        source: obs.source,
        type: obs.observationType,
        occurredAt: obs.occurredAt,
        metadata,
      } satisfies V1ContentItem;
    }),

    // Documents
    ...documents.map((doc) => {
      const metadata = doc.sourceMetadata as Record<string, unknown>;
      const frontmatter = (metadata.frontmatter ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        title: typeof frontmatter.title === "string" ? frontmatter.title : doc.sourceId,
        url: buildSourceUrl(doc.sourceType, doc.sourceId, metadata),
        snippet: typeof frontmatter.description === "string" ? frontmatter.description : "",
        source: doc.sourceType,
        type: "file",
        metadata: frontmatter,
      };
    }),
  ];

  // Track missing IDs
  const foundRequestIds = new Set([
    ...observationMap.keys(),
    ...documents.map((d) => d.id),
  ]);
  const missing = input.ids.filter((id) => !foundRequestIds.has(id));

  if (missing.length > 0) {
    log.warn("v1/contents missing IDs", { requestId: input.requestId, missing });
  }

  // Track contents fetch (fire-and-forget)
  recordSystemActivity({
    workspaceId: auth.workspaceId,
    actorType: auth.authType === "api-key" ? "api" : "user",
    actorUserId: auth.userId,
    category: "search",
    action: "search.contents",
    entityType: "contents_fetch",
    entityId: input.requestId,
    metadata: {
      requestedCount: input.ids.length,
      foundCount: items.length,
      missingCount: missing.length,
      latencyMs: Date.now() - startTime,
      authType: auth.authType,
      apiKeyId: auth.apiKeyId,
    },
  });

  log.debug("v1/contents logic complete", {
    requestId: input.requestId,
    itemCount: items.length,
    missingCount: missing.length,
  });

  return {
    items,
    missing,
    requestId: input.requestId,
  };
}
