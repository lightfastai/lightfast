import { describe, expect, it } from "vitest";

import * as developerConnectionContract from "../developer-connections";
import {
  DEVELOPER_CONNECTION_PROVIDERS,
  developerConnectionCompleteAuthInputSchema,
  developerConnectionConnectInputSchema,
  developerConnectionIssueLeaseInputSchema,
  developerConnectionProviderInputSchema,
  developerConnectionSetSandboxEnabledInputSchema,
  developerConnectionStartAuthInputSchema,
} from "../developer-connections";

describe("developer connection contracts", () => {
  it("defines the v1 provider schema without product catalog copy", () => {
    expect(DEVELOPER_CONNECTION_PROVIDERS).toEqual([
      "pscale",
      "upstash",
      "sentry",
      "clerk",
    ]);
    expect("DEVELOPER_CONNECTION_CATALOG" in developerConnectionContract).toBe(
      false
    );
  });

  it("validates provider input", () => {
    expect(
      developerConnectionProviderInputSchema.parse({ provider: "sentry" })
    ).toEqual({ provider: "sentry" });
    expect(() =>
      developerConnectionProviderInputSchema.parse({ provider: "vercel" })
    ).toThrow();
  });

  it("validates manual connect input per provider", () => {
    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "pscale",
        serviceTokenId: "token-id",
        serviceToken: "token-secret",
        providerAccountName: "lightfast/main",
      })
    ).toMatchObject({ provider: "pscale" });

    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "upstash",
        email: "dev@example.com",
        apiKey: "upstash-key",
        providerAccountName: "Lightfast Upstash",
      })
    ).toMatchObject({ provider: "upstash" });

    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "sentry",
        token: "sentry-token",
        providerAccountName: "lightfast/app",
      })
    ).toMatchObject({ provider: "sentry" });

    expect(
      developerConnectionConnectInputSchema.parse({
        provider: "clerk",
        appId: "app_123",
        instanceId: "dev",
        secretKey: "sk_test_123",
        providerAccountName: "Lightfast dev",
      })
    ).toMatchObject({ provider: "clerk" });
  });

  it("validates Sentry device-code auth inputs", () => {
    expect(
      developerConnectionStartAuthInputSchema.parse({
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).toEqual({
      provider: "sentry",
      providerAccountName: "lightfast/app",
    });

    expect(
      developerConnectionCompleteAuthInputSchema.parse({
        provider: "sentry",
        attemptId: "auth_attempt_123",
      })
    ).toEqual({
      provider: "sentry",
      attemptId: "auth_attempt_123",
    });

    expect(() =>
      developerConnectionStartAuthInputSchema.parse({
        provider: "clerk",
        providerAccountName: "Lightfast dev",
      })
    ).toThrow();
  });

  it("validates sandbox enablement input", () => {
    expect(
      developerConnectionSetSandboxEnabledInputSchema.parse({
        provider: "pscale",
        enabled: false,
      })
    ).toEqual({ provider: "pscale", enabled: false });
  });

  it("validates lease requests with explicit providers and bounded ids", () => {
    expect(
      developerConnectionIssueLeaseInputSchema.parse({
        providers: ["pscale", "sentry"],
        sandboxRunId: "sandbox_run_123",
        workflowRunId: "workflow_run_123",
      })
    ).toEqual({
      providers: ["pscale", "sentry"],
      sandboxRunId: "sandbox_run_123",
      workflowRunId: "workflow_run_123",
    });

    expect(() =>
      developerConnectionIssueLeaseInputSchema.parse({
        providers: [],
        sandboxRunId: "sandbox_run_123",
        workflowRunId: "workflow_run_123",
      })
    ).toThrow();
  });
});
