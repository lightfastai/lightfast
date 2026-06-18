import {
  getActiveOrgBinding,
  getCurrentOrgConnectorConnection,
  type SignalEntityEnrichmentTargetsResult,
} from "@db/app";
import { db } from "@db/app/client";
import { getGitHubUserByLogin } from "@lightfast/connector-github/node";
import { executeXApiTool } from "@lightfast/connector-x/tools";

import { env } from "../../env";
import { requireXConnectorConfig } from "../connectors/config";
import { getFreshXConnectorAccessToken } from "../connectors/x-mcp-bridge";
import { getGitHubAppConfig } from "../github/config";
import { getCachedGitHubInstallationToken } from "../github/installation-token-cache";

const LOCAL_X_EMULATOR_ACCESS_TOKEN = "x_access_valid";

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
    fetchXProfilesSafely(input, diagnostics),
    fetchGitHubProfilesSafely(input, diagnostics),
  ]);

  return {
    diagnostics,
    githubPayloads,
    xPayloads,
  };
}

async function fetchXProfilesSafely(
  input: FetchSignalEntityProfilesInput,
  diagnostics: Record<string, number>
): Promise<unknown[]> {
  try {
    return await fetchXProfiles(input, diagnostics);
  } catch {
    incrementDiagnostic(
      diagnostics,
      "x_profile_fetch_failed",
      input.targets.x.length
    );
    return [];
  }
}

async function fetchGitHubProfilesSafely(
  input: FetchSignalEntityProfilesInput,
  diagnostics: Record<string, number>
): Promise<unknown[]> {
  try {
    return await fetchGitHubProfiles(input, diagnostics);
  } catch {
    incrementDiagnostic(
      diagnostics,
      "github_profile_fetch_failed",
      input.targets.github.length
    );
    return [];
  }
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
    appUrl: process.env.VITE_LIGHTFAST_APP_URL,
    nodeEnv:
      env.VERCEL_ENV === "development" ? "development" : process.env.NODE_ENV,
  });
  const accessToken = await getXConnectorAccessToken({
    config,
    connection,
  });
  const toolInput = {
    usernames: input.targets.x.map((target) => target.value),
  };
  const result = await executeXApiToolWithLocalFallback({
    accessToken,
    apiOrigin: config.endpoints.apiOrigin,
    input: toolInput,
  });

  return extractXPayloads(result.structuredContent);
}

async function getXConnectorAccessToken(input: {
  config: ReturnType<typeof requireXConnectorConfig>;
  connection: NonNullable<
    Awaited<ReturnType<typeof getCurrentOrgConnectorConnection>>
  >;
}) {
  try {
    return await getFreshXConnectorAccessToken(input);
  } catch (error) {
    if (shouldUseLocalXEmulatorToken(input.config.endpoints.apiOrigin)) {
      return LOCAL_X_EMULATOR_ACCESS_TOKEN;
    }
    throw error;
  }
}

function shouldUseLocalXEmulatorToken(apiOrigin: string): boolean {
  if (env.VERCEL_ENV !== "development") {
    return false;
  }

  try {
    const hostname = new URL(apiOrigin).hostname;
    return hostname === "localhost" || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

async function executeXApiToolWithLocalFallback(input: {
  accessToken: string;
  apiOrigin: string;
  input: { usernames: string[] };
}) {
  try {
    return await executeXApiTool({
      accessToken: input.accessToken,
      apiOrigin: input.apiOrigin,
      input: input.input,
      name: "getUsersByUsernames",
    });
  } catch (error) {
    if (
      input.accessToken !== LOCAL_X_EMULATOR_ACCESS_TOKEN &&
      shouldUseLocalXEmulatorToken(input.apiOrigin)
    ) {
      return executeXApiTool({
        accessToken: LOCAL_X_EMULATOR_ACCESS_TOKEN,
        apiOrigin: input.apiOrigin,
        input: input.input,
        name: "getUsersByUsernames",
      });
    }
    throw error;
  }
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
  let token: string;
  try {
    token = await getCachedGitHubInstallationToken({
      installationId: binding.providerInstallationId,
    });
  } catch {
    incrementDiagnostic(
      diagnostics,
      "github_profile_fetch_failed",
      input.targets.github.length
    );
    return [];
  }

  const payloads: unknown[] = [];
  for (const target of input.targets.github) {
    try {
      payloads.push(
        await getGitHubUserByLogin({
          apiBaseUrl: config.endpoints.apiBaseUrl,
          apiVersion: config.apiVersion,
          login: target.value,
          token,
        })
      );
    } catch {
      incrementDiagnostic(diagnostics, "github_profile_fetch_failed", 1);
    }
  }
  return payloads;
}

function extractXPayloads(structuredContent: unknown): unknown[] {
  if (!(isRecord(structuredContent) && "data" in structuredContent)) {
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
