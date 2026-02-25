import { and, eq } from "drizzle-orm";
import { gwInstallations, gwResources, gwTokens } from "@db/console/schema";
import { serve } from "@vendor/upstash-workflow/hono";
import { db } from "@db/console/client";
import { decrypt } from "../lib/crypto";
import { deleteResourceCache } from "../lib/resource-cache";
import { env } from "../env";
import { getProvider } from "../providers";
import type { ProviderName, WebhookRegistrant } from "../providers/types";

interface TeardownPayload {
  installationId: string;
  provider: ProviderName;
  orgId: string;
}

/**
 * Durable connection teardown workflow.
 *
 * Replaces the synchronous 5-step teardown with step-level durability:
 * - Step 1: Revoke token at provider (best-effort)
 * - Step 2: Deregister webhook if applicable (best-effort)
 * - Step 3: Clean up Redis cache for linked resources
 * - Step 4: Soft-delete installation and resources in DB
 *
 * Each step runs independently with automatic retries.
 */
export const connectionTeardownWorkflow = serve<TeardownPayload>(
  async (context) => {
    const { installationId, provider: providerName } = context.requestPayload;

    // Step 1: Revoke token at provider (best-effort)
    await context.run("revoke-token", async () => {
      if (providerName === "github") return; // GitHub uses on-demand JWTs, no stored token

      const provider = getProvider(providerName);
      const tokenRows = await db
        .select()
        .from(gwTokens)
        .where(eq(gwTokens.installationId, installationId))
        .limit(1);

      const tokenRow = tokenRows[0];
      if (!tokenRow) return;

      try {
        const decryptedToken = await decrypt(tokenRow.accessToken, env.ENCRYPTION_KEY);
        await provider.revokeToken(decryptedToken);
      } catch {
        // Best-effort — swallow errors
      }
    });

    // Step 2: Deregister webhook if applicable (best-effort)
    await context.run("deregister-webhook", async () => {
      const provider = getProvider(providerName);
      if (!provider.requiresWebhookRegistration) return;

      const installationRows = await db
        .select()
        .from(gwInstallations)
        .where(eq(gwInstallations.id, installationId))
        .limit(1);

      const installation = installationRows[0];
      if (!installation) return;

      const registrant = provider as WebhookRegistrant;
      const meta = installation.metadata as Record<string, unknown> | null;
      const webhookId = meta?.webhookId as string | undefined;

      if (webhookId) {
        try {
          await registrant.deregisterWebhook(installationId, webhookId);
        } catch {
          // Best-effort — swallow errors
        }
      }
    });

    // Step 3: Clean up Redis cache for linked resources
    await context.run("cleanup-cache", async () => {
      const linkedResources = await db
        .select({ providerResourceId: gwResources.providerResourceId })
        .from(gwResources)
        .where(
          and(
            eq(gwResources.installationId, installationId),
            eq(gwResources.status, "active"),
          ),
        );

      for (const r of linkedResources) {
        await deleteResourceCache(providerName, r.providerResourceId);
      }
    });

    // Step 4: Soft-delete installation and resources in DB
    await context.run("soft-delete", async () => {
      await db
        .update(gwInstallations)
        .set({ status: "revoked", updatedAt: new Date().toISOString() })
        .where(eq(gwInstallations.id, installationId));

      await db
        .update(gwResources)
        .set({ status: "removed" })
        .where(eq(gwResources.installationId, installationId));
    });
  },
  {
    failureFunction: ({ context, failStatus, failResponse }) => {
      console.error("[connection-teardown] workflow failed", {
        failStatus,
        failResponse,
        context,
      });
      return Promise.resolve();
    },
  },
);
