/**
 * Agent Triage
 *
 * Triggered by `platform/event.stored`. Loads the org's `.lightfast/` config
 * (SPEC.md + skill manifests) from the indexed GitHub repo, runs one Claude
 * Haiku 4.5 structured-output call to decide whether any skill should run,
 * and emits `platform/agent.decided` for both skip/invoke outcomes.
 *
 * v1 is read-only — no memory writes, no skill execution, no tool calls.
 */

import { gateway } from "@ai-sdk/gateway";
import { db } from "@db/app/client";
import {
  gatewayInstallations,
  orgEvents,
  orgIntegrations,
  orgRepoIndexes,
} from "@db/app/schema";
import {
  buildTriageSystemPrompt,
  buildTriageUserPrompt,
  type Fetcher,
  type FetcherResult,
  parseDotLightfast,
  TriageDecisionSchema,
} from "@repo/dotlightfast";
import { NonRetriableError } from "@vendor/inngest";
import { log } from "@vendor/observability/log/next";
import { generateObject } from "ai";
import { and, eq } from "drizzle-orm";
import { platformRouter } from "../../root";
import { inngest } from "../client";

const TRIAGE_MODEL = "anthropic/claude-haiku-4.5";

export const platformAgentTriage = inngest.createFunction(
  {
    id: "platform/agent.triage",
    name: "Agent Triage",
    description:
      "Loads .lightfast config and runs a triage LLM call on stored events",
    retries: 2,
    idempotency: "event.data.clerkOrgId + '-' + event.data.eventExternalId",
    concurrency: { limit: 5, key: "event.data.clerkOrgId" },
    timeouts: { start: "1m", finish: "3m" },
  },
  { event: "platform/event.stored" },
  async ({ event, step }) => {
    const {
      clerkOrgId,
      eventExternalId,
      sourceType,
      significanceScore,
      correlationId,
    } = event.data;

    // ─── Step 1: resolve repo context ──────────────────────────────────
    const repoContext = await step.run("resolve-repo-context", async () => {
      const rows = await db
        .select({
          installationId: gatewayInstallations.id,
          repoFullName: orgRepoIndexes.repoFullName,
        })
        .from(orgRepoIndexes)
        .innerJoin(
          orgIntegrations,
          eq(orgIntegrations.id, orgRepoIndexes.integrationId)
        )
        .innerJoin(
          gatewayInstallations,
          eq(gatewayInstallations.id, orgIntegrations.installationId)
        )
        .where(
          and(
            eq(orgRepoIndexes.clerkOrgId, clerkOrgId),
            eq(orgRepoIndexes.isActive, true)
          )
        )
        .limit(1);

      const row = rows[0];
      if (!row) {
        return null;
      }

      const [owner, repo] = row.repoFullName.split("/");
      if (!(owner && repo)) {
        throw new NonRetriableError(
          `malformed repoFullName: ${row.repoFullName}`
        );
      }
      return { installationId: row.installationId, owner, repo };
    });

    if (!repoContext) {
      log.info("agent triage skipped: no active repo index", {
        clerkOrgId,
        eventExternalId,
      });
      return { skipped: "no_active_repo_index" as const };
    }

    // ─── Step 2: load .lightfast/ config ───────────────────────────────
    const config = await step.run("load-dotlightfast", async () => {
      const caller = platformRouter.createCaller({
        auth: { type: "service" as const, caller: "inngest" },
        headers: new Headers(),
      });

      const fetcher: Fetcher = async (path): Promise<FetcherResult> => {
        const result = await caller.proxy.execute({
          installationId: repoContext.installationId,
          endpointId: "get-file-contents",
          pathParams: {
            owner: repoContext.owner,
            repo: repoContext.repo,
            path,
          },
        });

        if (result.status === 404) {
          return { type: "missing" };
        }
        if (result.status !== 200) {
          throw new Error(`get-file-contents ${path} → ${result.status}`);
        }

        const data = result.data;
        if (Array.isArray(data)) {
          return {
            type: "dir",
            entries: data
              .filter(
                (e): e is { type: "file" | "dir"; name: string } =>
                  typeof e === "object" &&
                  e !== null &&
                  "type" in e &&
                  "name" in e &&
                  (e.type === "file" || e.type === "dir") &&
                  typeof e.name === "string"
              )
              .map((e) => ({ name: e.name, type: e.type })),
          };
        }

        if (
          data &&
          typeof data === "object" &&
          "content" in data &&
          typeof (data as { content: unknown }).content === "string"
        ) {
          const b64 = (data as { content: string }).content;
          const decoded = Buffer.from(b64, "base64").toString("utf-8");
          return { type: "file", content: decoded };
        }

        return { type: "missing" };
      };

      return parseDotLightfast(fetcher);
    });

    if (!config.spec && config.skills.length === 0) {
      log.info("agent triage skipped: no .lightfast config", {
        clerkOrgId,
        eventExternalId,
      });
      return { skipped: "no_dotlightfast_config" as const };
    }

    // ─── Step 3: load event row ────────────────────────────────────────
    const eventRow = await step.run("load-event", async () => {
      const rows = await db
        .select()
        .from(orgEvents)
        .where(eq(orgEvents.externalId, eventExternalId))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new NonRetriableError(
          `orgEvents row not found for externalId=${eventExternalId}`
        );
      }
      return row;
    });

    // ─── Step 4: triage LLM call ───────────────────────────────────────
    const decision = await step.run("triage", async () => {
      const system = buildTriageSystemPrompt(config);
      const user = buildTriageUserPrompt({
        externalId: eventRow.externalId,
        source: eventRow.source,
        sourceType: eventRow.sourceType,
        observationType: eventRow.observationType,
        title: eventRow.title,
        content: eventRow.content,
        occurredAt: eventRow.occurredAt,
        significanceScore: eventRow.significanceScore ?? significanceScore ?? 0,
      });

      const { object } = await generateObject({
        model: gateway(TRIAGE_MODEL),
        schema: TriageDecisionSchema,
        system,
        prompt: user,
        temperature: 0.1,
      });

      if (object.decision === "invoke") {
        if (!object.skillName) {
          throw new Error("invoke decision missing skillName");
        }
        const match = config.skills.find((s) => s.name === object.skillName);
        if (!match) {
          // LLM hallucinated a skill name — degrade to skip rather than fail.
          log.warn("triage selected unknown skill, degrading to skip", {
            clerkOrgId,
            eventExternalId,
            selected: object.skillName,
          });
          return {
            decision: "skip" as const,
            skillName: undefined,
            reasoning: `selected unknown skill "${object.skillName}"; degraded to skip`,
          };
        }
      }
      return object;
    });

    // ─── Step 5: emit decision ─────────────────────────────────────────
    await step.sendEvent("emit-agent-decided", {
      name: "platform/agent.decided" as const,
      data: {
        clerkOrgId,
        eventExternalId,
        decision: decision.decision,
        skillName: decision.skillName,
        reasoning: decision.reasoning,
        correlationId,
      },
    });

    log.info("agent triage decided", {
      clerkOrgId,
      eventExternalId,
      sourceType,
      decision: decision.decision,
      skillName: decision.skillName,
    });

    return {
      decision: decision.decision,
      skillName: decision.skillName,
      reasoning: decision.reasoning,
    };
  }
);
