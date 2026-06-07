import {
  getActiveOrgBinding,
  getCurrentOrgConnectorConnection,
  type SignalEntityEnrichmentTargetsResult,
} from "@db/app";
import { db } from "@db/app/client";
import { getGitHubUserByLogin } from "@repo/github-app-node";
import { executeXApiTool } from "@repo/x-app-node";

import { env } from "../../env";
import { requireXConnectorConfig } from "../connectors/config";
import { getFreshXConnectorAccessToken } from "../connectors/x-mcp-bridge";
import { getGitHubAppConfig } from "../github/config";
import { getCachedGitHubInstallationToken } from "../github/installation-token-cache";

export interface FetchSignalEntityProfilesInput {
  clerkOrgId: string;
  targets: SignalEntityEnrichmentTargetsResult;
}

export interface FetchSignalEntityProfilesResult {
  diagnostics: Record<string, number>;
  githubPayloads: unknown[];
  xPayloads: unknown[];
}

export async function fetchSignalEntityProfiles(
  input: FetchSignalEntityProfilesInput
): Promise<FetchSignalEntityProfilesResult> {
  const diagnostics: Record<string, number> = {};
  const [xPayloads, githubPayloads] = await Promise.all([
    fetchXProfiles(input, diagnostics),
    fetchGitHubProfiles(input, diagnostics),
  ]);

  return {
    diagnostics,
    githubPayloads,
    xPayloads,
  };
}

async function fetchXProfiles(
  input: FetchSignalEntityProfilesInput,
  diagnostics: Record<string, number>
): Promise<unknown[]> {
  if (input.targets.x.length === 0) {
    return [];
  }

  const connection = await getCurrentOrgConnectorConnection(db, {
    clerkOrgId: input.clerkOrgId,
    provider: "x",
  });
  if (!connection) {
    incrementDiagnostic(
      diagnostics,
      "x_missing_connection",
      input.targets.x.length
    );
    return [];
  }

  const config = requireXConnectorConfig({
    appUrl: env.NEXT_PUBLIC_APP_URL,
  });
  const accessToken = await getFreshXConnectorAccessToken({
    config,
    connection,
  });
  const result = await executeXApiTool({
    accessToken,
    apiOrigin: config.endpoints.apiOrigin,
    input: {
      usernames: input.targets.x.map((target) => target.value),
    },
    name: "getUsersByUsernames",
  });

  return extractXPayloads(result.structuredContent);
}

async function fetchGitHubProfiles(
  input: FetchSignalEntityProfilesInput,
  diagnostics: Record<string, number>
): Promise<unknown[]> {
  if (input.targets.github.length === 0) {
    return [];
  }

  const binding = await getActiveOrgBinding(db, input.clerkOrgId);
  if (!binding || binding.provider !== "github") {
    incrementDiagnostic(
      diagnostics,
      "github_missing_binding",
      input.targets.github.length
    );
    return [];
  }
  if (!binding.providerInstallationId) {
    incrementDiagnostic(
      diagnostics,
      "github_missing_installation",
      input.targets.github.length
    );
    return [];
  }

  const config = getGitHubAppConfig();
  const token = await getCachedGitHubInstallationToken({
    installationId: binding.providerInstallationId,
  });
  const payloads: unknown[] = [];
  for (const target of input.targets.github) {
    payloads.push(
      await getGitHubUserByLogin({
        apiBaseUrl: config.endpoints.apiBaseUrl,
        apiVersion: config.apiVersion,
        login: target.value,
        token,
      })
    );
  }
  return payloads;
}

function extractXPayloads(structuredContent: unknown): unknown[] {
  if (!isRecord(structuredContent) || !("data" in structuredContent)) {
    return [];
  }

  const data = structuredContent.data;
  if (Array.isArray(data)) {
    return data;
  }
  return isRecord(data) ? [data] : [];
}

function incrementDiagnostic(
  diagnostics: Record<string, number>,
  key: string,
  value: number
) {
  diagnostics[key] = (diagnostics[key] ?? 0) + value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
