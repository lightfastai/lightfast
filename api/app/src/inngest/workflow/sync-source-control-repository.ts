import {
  getOrgBindingByProviderInstallation,
  getWatchedSourceControlRepositoryById,
  markSourceControlWebhookDeliveryStatus,
  markWatchedSourceControlRepositoryPushProcessed,
} from "@db/app";
import { db } from "@db/app/client";
import {
  createGitHubAppJwt,
  createGitHubInstallationToken,
  getGitHubCommit,
  getGitHubTree,
} from "@repo/github-app-node";
import {
  matchesWatchedPath,
  splitRepositoryFullName,
} from "@repo/source-control-contract";

import { getGitHubAppConfig } from "../../services/github/config";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

export const syncSourceControlRepository = inngest.createFunction(
  {
    id: "sync-source-control-repository",
    idempotency: "event.data.deliveryId",
    onFailure: async ({ event, step }) => {
      const { deliveryId } = event.data.event.data;
      await step.run("mark source control delivery failed", () =>
        markSourceControlWebhookDeliveryStatusOrThrow({
          deliveryId,
          status: "failed",
        })
      );
      return { status: "failed" as const };
    },
    retries: 2,
    timeouts: {
      finish: "5m",
      start: "5m",
    },
    triggers: appEvents["app/source-control.repository.push.received"],
  },
  async ({ event, step }) => {
    const watch = await step.run("load watched source control repository", () =>
      getWatchedSourceControlRepositoryById(db, {
        id: event.data.repositoryWatchId,
      })
    );
    if (
      !watch ||
      watch.orgSourceControlBindingId !== event.data.orgSourceControlBindingId ||
      watch.providerRepositoryId !== event.data.providerRepositoryId
    ) {
      await step.run("mark source control delivery ignored", () =>
        markSourceControlWebhookDeliveryStatusOrThrow({
          deliveryId: event.data.deliveryId,
          status: "ignored",
        })
      );
      return { status: "missing-watch" as const };
    }

    const binding = await step.run("load source control binding", () =>
      getOrgBindingByProviderInstallation(db, {
        provider: "github",
        providerInstallationId: event.data.providerInstallationId,
      })
    );
    if (
      !binding ||
      binding.id !== event.data.orgSourceControlBindingId ||
      binding.providerInstallationId !== event.data.providerInstallationId ||
      binding.status !== "active"
    ) {
      await step.run("mark source control delivery ignored", () =>
        markSourceControlWebhookDeliveryStatusOrThrow({
          deliveryId: event.data.deliveryId,
          status: "ignored",
        })
      );
      return { status: "missing-binding" as const };
    }

    const config = getGitHubAppConfig();
    const { owner, repo } = splitRepositoryFullName(
      event.data.repositoryFullName
    );

    const appJwt = await step.run("create github app jwt", () =>
      createGitHubAppJwt({
        appId: config.appId,
        privateKey: config.privateKey,
      })
    );

    const installationToken = await step.run(
      "create github installation token",
      () =>
        createGitHubInstallationToken({
          apiBaseUrl: config.endpoints.apiBaseUrl,
          apiVersion: config.apiVersion,
          appJwt,
          installationId: event.data.providerInstallationId,
        })
    );

    const commit = await step.run("fetch github commit", () =>
      getGitHubCommit({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        installationToken: installationToken.token,
        owner,
        ref: event.data.afterSha,
        repo,
      })
    );

    const tree = await step.run("fetch github tree", () =>
      getGitHubTree({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        installationToken: installationToken.token,
        owner,
        recursive: true,
        repo,
        treeSha: commit.treeSha,
      })
    );

    if (tree.truncated === true) {
      throw new Error(
        `GitHub tree ${commit.treeSha} for ${event.data.repositoryFullName} was truncated.`
      );
    }

    const matchedPathCount = tree.tree.filter((entry) =>
      matchesWatchedPath(entry.path, watch.watchedPathGlobs)
    ).length;

    await step.run("mark watched repository push processed", () =>
      markWatchedSourceControlRepositoryPushProcessed(db, {
        deliveryId: event.data.deliveryId,
        lastProcessedSha: event.data.afterSha,
        repositoryWatchId: event.data.repositoryWatchId,
      })
    );

    return { matchedPathCount, status: "processed" as const };
  }
);

async function markSourceControlWebhookDeliveryStatusOrThrow(input: {
  deliveryId: string;
  status: "failed" | "ignored";
}) {
  const updated = await markSourceControlWebhookDeliveryStatus(db, input);
  if (!updated) {
    throw new Error(
      `Failed to mark source control webhook delivery ${input.deliveryId} ${input.status}.`
    );
  }
}
