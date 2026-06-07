import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = {
  CONNECTOR_MCP_AUTH_SECRET: "mcp_auth_secret_12345678901234567890",
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
  VERCEL_ENV: "test",
};

vi.mock("../env", () => ({ env: envMock }));

const { issueConnectorMcpToken, verifyConnectorMcpToken } = await import(
  "../services/connectors/mcp-auth"
);

function resignToken(input: {
  payload: Record<string, unknown>;
  secret?: string;
}) {
  const payloadSegment = Buffer.from(
    JSON.stringify(input.payload),
    "utf8"
  ).toString("base64url");
  const signature = createHmac(
    "sha256",
    input.secret ?? envMock.CONNECTOR_MCP_AUTH_SECRET
  )
    .update(payloadSegment)
    .digest("base64url");
  return `lfmcp_v1.${payloadSegment}.${signature}`;
}

function decodePayload(token: string): Record<string, unknown> {
  const payloadSegment = token.split(".")[1];
  if (!payloadSegment) {
    throw new Error("missing payload");
  }
  return JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"));
}

describe("connector MCP auth", () => {
  beforeEach(() => {
    vi.useRealTimers();
    envMock.CONNECTOR_MCP_AUTH_SECRET = "mcp_auth_secret_12345678901234567890";
    envMock.VERCEL_ENV = "test";
  });

  it("issues and verifies Lightfast MCP bearer tokens", async () => {
    const now = new Date("2026-06-02T01:00:00.000Z");

    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now,
      provider: "x",
      purpose: "list",
    });

    expect(token).toMatch(/^lfmcp_v1\./);
    await expect(
      verifyConnectorMcpToken({
        now,
        provider: "x",
        purpose: "list",
        token,
      })
    ).resolves.toMatchObject({
      aud: "connector-mcp:x",
      clerkOrgId: "org_acme",
      connectionId: 42,
      iss: "lightfast-connectors",
      provider: "x",
      purpose: "list",
    });
  });

  it("issues and verifies discovery tokens for manifest refresh", async () => {
    const now = new Date("2026-06-02T01:00:00.000Z");

    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now,
      provider: "x",
      purpose: "discover",
    });

    await expect(
      verifyConnectorMcpToken({
        now,
        provider: "x",
        purpose: "discover",
        token,
      })
    ).resolves.toMatchObject({
      clerkOrgId: "org_acme",
      connectionId: 42,
      provider: "x",
      purpose: "discover",
    });
  });

  it("rejects expired tokens", async () => {
    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now: new Date("2026-06-02T01:00:00.000Z"),
      provider: "x",
      purpose: "list",
      ttlSeconds: 60,
    });

    await expect(
      verifyConnectorMcpToken({
        now: new Date("2026-06-02T01:01:01.000Z"),
        provider: "x",
        purpose: "list",
        token,
      })
    ).rejects.toThrow("Connector MCP token is expired.");
  });

  it("rejects wrong audience", async () => {
    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now: new Date("2026-06-02T01:00:00.000Z"),
      provider: "x",
      purpose: "list",
    });
    const payload = decodePayload(token);
    const wrongAudienceToken = resignToken({
      payload: { ...payload, aud: "connector-mcp:linear" },
    });

    await expect(
      verifyConnectorMcpToken({
        now: new Date("2026-06-02T01:00:00.000Z"),
        provider: "x",
        purpose: "list",
        token: wrongAudienceToken,
      })
    ).rejects.toThrow("Connector MCP token audience is invalid.");
  });

  it("rejects wrong provider", async () => {
    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now: new Date("2026-06-02T01:00:00.000Z"),
      provider: "x",
      purpose: "list",
    });

    await expect(
      verifyConnectorMcpToken({
        now: new Date("2026-06-02T01:00:00.000Z"),
        provider: "linear",
        purpose: "list",
        token,
      })
    ).rejects.toThrow("Connector MCP token provider is invalid.");
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fraction", 60.5],
    ["non-finite", Number.NaN],
  ])("rejects non-positive integer ttl: %s", async (_case, ttlSeconds) => {
    await expect(
      issueConnectorMcpToken({
        clerkOrgId: "org_acme",
        connectionId: 42,
        now: new Date("2026-06-02T01:00:00.000Z"),
        provider: "x",
        purpose: "list",
        ttlSeconds,
      })
    ).rejects.toThrow("Connector MCP token TTL must be a positive integer.");
  });

  it("rejects wrong purpose", async () => {
    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now: new Date("2026-06-02T01:00:00.000Z"),
      provider: "x",
      purpose: "list",
    });

    await expect(
      verifyConnectorMcpToken({
        now: new Date("2026-06-02T01:00:00.000Z"),
        provider: "x",
        purpose: "call",
        token,
      })
    ).rejects.toThrow("Connector MCP token purpose is invalid.");
  });

  it("rejects a call token with a mismatched tool name", async () => {
    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now: new Date("2026-06-02T01:00:00.000Z"),
      provider: "x",
      purpose: "call",
      toolName: "getUsersMe",
    });

    await expect(
      verifyConnectorMcpToken({
        now: new Date("2026-06-02T01:00:00.000Z"),
        provider: "x",
        purpose: "call",
        token,
        toolName: "getUsersByUsername",
      })
    ).rejects.toThrow("Connector MCP token tool name is invalid.");
  });

  it("rejects modified signatures", async () => {
    const token = await issueConnectorMcpToken({
      clerkOrgId: "org_acme",
      connectionId: 42,
      now: new Date("2026-06-02T01:00:00.000Z"),
      provider: "x",
      purpose: "list",
    });
    const modifiedToken = `${token.slice(0, -1)}x`;

    await expect(
      verifyConnectorMcpToken({
        now: new Date("2026-06-02T01:00:00.000Z"),
        provider: "x",
        purpose: "list",
        token: modifiedToken,
      })
    ).rejects.toThrow("Connector MCP token signature is invalid.");
  });
});
