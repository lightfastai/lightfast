/**
 * Repo Index Sync
 *
 * Triggered by push webhooks to indexed repos (day 1: .lightfast).
 * Fetches README.md and updates the cached content in orgRepoIndexes.
 *
 * Runs in parallel with ingestDelivery (which marks push events as "skipped").
 */

import { db } from "@db/app/client";
import {
  gatewayInstallations,
  orgIntegrations,
  orgRepoIndexes,
} from "@db/app/schema";
import type { ProviderDefinition } from "@repo/app-providers";
import { getProvider } from "@repo/app-providers";
import { NonRetriableError } from "@vendor/inngest";
import { log } from "@vendor/observability/log/next";
import { and, eq } from "drizzle-orm";
import { providerConfigs } from "../../lib/provider-configs";
import { getActiveTokenForInstallation } from "../../lib/token-helpers";
import { inngest } from "../client";

export const platformRepoIndexSync = inngest.createFunction(
  {
    id: "platform/repo-index.sync",
    name: "Repo Index Sync",
    description: "Syncs indexed repo content (README.md) on push events",
    retries: 3,
    timeouts: {
      start: "30s",
      finish: "2m",
    },
  },
  { event: "platform/webhook.received" },
  async ({ event, step }) => {
    const data = event.data;

    // Only handle push events from GitHub
    if (data.provider !== "github" || data.eventType !== "push") {
      return { status: "skipped", reason: "not_github_push" };
    }

    if (!data.resourceId) {
      return { status: "skipped", reason: "no_resource_id" };
    }

    // Step 1: Check if this repo has an active context config
    const contextConfig = await step.run("check-context-config", async () => {
      const [config] = await db
        .select({
          id: orgRepoIndexes.id,
          clerkOrgId: orgRepoIndexes.clerkOrgId,
          integrationId: orgRepoIndexes.integrationId,
          contentSha: orgRepoIndexes.contentSha,
        })
        .from(orgRepoIndexes)
        .where(
          and(
            eq(orgRepoIndexes.providerResourceId, data.resourceId!),
            eq(orgRepoIndexes.isActive, true)
          )
        )
        .limit(1);

      return config ?? null;
    });

    if (!contextConfig) {
      return { status: "skipped", reason: "no_active_context_config" };
    }

    // Step 2: Get installation details for API auth
    const installationInfo = await step.run(
      "resolve-installation",
      async () => {
        const [integration] = await db
          .select({
            installationId: orgIntegrations.installationId,
          })
          .from(orgIntegrations)
          .where(eq(orgIntegrations.id, contextConfig.integrationId))
          .limit(1);

        if (!integration) {
          throw new NonRetriableError("integration_not_found");
        }

        const [installation] = await db
          .select({
            id: gatewayInstallations.id,
            externalId: gatewayInstallations.externalId,
            provider: gatewayInstallations.provider,
          })
          .from(gatewayInstallations)
          .where(eq(gatewayInstallations.id, integration.installationId))
          .limit(1);

        if (!installation) {
          throw new NonRetriableError("installation_not_found");
        }

        return installation;
      }
    );

    // Step 3: Fetch README.md from GitHub
    const fileContent = await step.run("fetch-readme", async () => {
      const providerDef = getProvider("github");
      const config = providerConfigs.github;

      const { token } = await getActiveTokenForInstallation(
        installationInfo,
        config,
        providerDef as ProviderDefinition
      );

      // Extract owner/repo from the push payload
      const payload = data.payload as {
        repository?: { full_name?: string };
      };
      const fullName = payload?.repository?.full_name;
      if (!fullName) {
        throw new NonRetriableError("no_repo_full_name_in_payload");
      }

      const [owner, repo] = fullName.split("/");

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/README.md`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (response.status === 404) {
        return { found: false as const };
      }

      if (!response.ok) {
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText}`
        );
      }

      const fileData = (await response.json()) as {
        content?: string;
        sha?: string;
      };

      if (!fileData.content) {
        return { found: false as const };
      }

      // Skip update if SHA hasn't changed
      if (fileData.sha && fileData.sha === contextConfig.contentSha) {
        return { found: true as const, unchanged: true as const };
      }

      const decoded = Buffer.from(fileData.content, "base64").toString("utf-8");
      return {
        found: true as const,
        unchanged: false as const,
        content: decoded,
        sha: fileData.sha ?? null,
      };
    });

    if (!fileContent.found) {
      log.info("README.md not found in .lightfast repo", {
        configId: contextConfig.id,
      });
      return { status: "no_readme" };
    }

    if (fileContent.unchanged) {
      return { status: "unchanged" };
    }

    // Step 4: Update the cached content
    await step.run("update-cache", async () => {
      await db
        .update(orgRepoIndexes)
        .set({
          cachedContent: fileContent.content,
          contentSha: fileContent.sha,
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(orgRepoIndexes.id, contextConfig.id));
    });

    log.info("[repo-index] synced", {
      configId: contextConfig.id,
      clerkOrgId: contextConfig.clerkOrgId,
    });

    return { status: "synced", configId: contextConfig.id };
  }
);
