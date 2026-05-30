import {
  getWatchedSourceControlRepositoryById,
  markSourceControlWebhookDeliveryStatus,
  updateWatchedSourceControlRepositoryLastProcessedSha,
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
        markSourceControlWebhookDeliveryStatus(db, {
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
    const config = getGitHubAppConfig();
    const { owner, repo } = splitRepositoryFullName(
      event.data.repositoryFullName
    );

    const watch = await step.run("load watched source control repository", () =>
      getWatchedSourceControlRepositoryById(db, {
        id: event.data.repositoryWatchId,
      })
    );
    if (!watch) {
      return { status: "missing-watch" as const };
    }

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

    const matchedPathCount = tree.tree.filter((entry) =>
      matchesWatchedPath(entry.path, watch.watchedPathGlobs)
    ).length;

    await step.run("update watched repository processed sha", () =>
      updateWatchedSourceControlRepositoryLastProcessedSha(db, {
        id: event.data.repositoryWatchId,
        lastProcessedSha: event.data.afterSha,
      })
    );

    await step.run("mark source control delivery processed", () =>
      markSourceControlWebhookDeliveryStatus(db, {
        deliveryId: event.data.deliveryId,
        status: "processed",
      })
    );

    return { matchedPathCount, status: "processed" as const };
  }
);
