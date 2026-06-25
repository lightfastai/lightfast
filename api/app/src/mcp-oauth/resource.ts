import { McpOAuthError } from "./types";

const UNSUPPORTED_RESOURCE_MESSAGE = "Unsupported MCP resource.";

export function requireHostedMcpResource(resource: string): string {
  const configuredResource = process.env.MCP_RESOURCE_URL;
  if (!configuredResource) {
    throw new Error("Hosted MCP resource URL is not configured.");
  }

  const expected = canonicalConfiguredMcpResource(configuredResource);
  const actual = canonicalOAuthResource(resource);
  if (actual !== expected) {
    throw new McpOAuthError("invalid_request", UNSUPPORTED_RESOURCE_MESSAGE);
  }
  return expected;
}

export function canonicalOAuthResource(resource: string): string {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    throw new McpOAuthError("invalid_request", UNSUPPORTED_RESOURCE_MESSAGE);
  }
  if (url.hash) {
    throw new McpOAuthError("invalid_request", UNSUPPORTED_RESOURCE_MESSAGE);
  }
  return url.toString();
}

function canonicalConfiguredMcpResource(resource: string): string {
  try {
    return canonicalOAuthResource(resource);
  } catch (error) {
    throw new Error("Hosted MCP resource URL is invalid.", { cause: error });
  }
}
