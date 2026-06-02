import { randomBytes, randomUUID } from "node:crypto";

export function createMcpClientId(): string {
  return `mcp_client_${randomUUID()}`;
}

export function createMcpGrantId(): string {
  return `mcp_grant_${randomUUID()}`;
}

export function createAuthorizationCodeSecret(): string {
  return `mcp_code_${randomBytes(32).toString("base64url")}`;
}

export function createRefreshTokenSecret(): string {
  return `mcp_refresh_${randomBytes(32).toString("base64url")}`;
}

export function createRegistrationAccessTokenSecret(): string {
  return `mcp_reg_${randomBytes(32).toString("base64url")}`;
}
