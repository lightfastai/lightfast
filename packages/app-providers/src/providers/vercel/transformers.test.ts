/**
 * Transformer unit tests for Vercel deployment webhooks.
 *
 * Covers all 4 enum types including deployment.error and deployment.canceled
 * which previously caused ZodErrors in production (Sentry LIGHTFAST-PLATFORM-22/24).
 */
import { describe, expect, it } from "vitest";
import type { TransformContext } from "../../provider/primitives";
import {
  preTransformVercelWebhookPayloadSchema,
  vercelWebhookEventTypeSchema,
} from "./schemas";
import { transformVercelDeployment } from "./transformers";

const context: TransformContext = {
  deliveryId: "vercel-webhook-transformer-test",
  receivedAt: Date.now(),
};

// Minimal deployment payload — mirrors the sanitized fixture shape from
// packages/webhook-schemas/fixtures/vercel/*.json. Every field the transformer
// reads is present.
function buildPayload(eventType: string, readyState?: string) {
  return preTransformVercelWebhookPayloadSchema.parse({
    id: "evt-abc123",
    type: eventType,
    createdAt: 1_777_015_529_600,
    payload: {
      project: { id: "prj_test", name: "my-app" },
      team: { id: "team_test" },
      deployment: {
        id: "dpl_test",
        name: "my-app",
        url: "my-app.vercel.app",
        readyState,
        meta: {
          githubCommitSha: "abc123def456",
          githubCommitRef: "main",
          githubCommitMessage: "feat: ship it",
          githubRepo: "my-app",
          githubOrg: "my-org",
        },
      },
      target: "production",
    },
  });
}

describe("transformVercelDeployment", () => {
  it("accepts all 4 enum literals without throwing", () => {
    for (const eventType of vercelWebhookEventTypeSchema.options) {
      expect(() =>
        transformVercelDeployment(buildPayload(eventType), context, eventType)
      ).not.toThrow();
    }
  });

  it("produces 'Deployment Failed' title for deployment.error", () => {
    const event = transformVercelDeployment(
      buildPayload("deployment.error", "ERROR"),
      context,
      "deployment.error"
    );
    expect(event.eventType).toBe("deployment.error");
    expect(event.title).toContain("Deployment Failed");
    expect(event.body).toContain("!");
    expect(event.entity.state).toBe("error");
  });

  it("produces 'Deployment Canceled' title for deployment.canceled", () => {
    const event = transformVercelDeployment(
      buildPayload("deployment.canceled", "CANCELED"),
      context,
      "deployment.canceled"
    );
    expect(event.eventType).toBe("deployment.canceled");
    expect(event.title).toContain("Deployment Canceled");
    expect(event.body).toContain("~");
    expect(event.entity.state).toBe("canceled");
  });

  it("sourceId encodes the eventType — error and canceled get distinct ids", () => {
    const errorEvent = transformVercelDeployment(
      buildPayload("deployment.error", "ERROR"),
      context,
      "deployment.error"
    );
    const canceledEvent = transformVercelDeployment(
      buildPayload("deployment.canceled", "CANCELED"),
      context,
      "deployment.canceled"
    );
    expect(errorEvent.sourceId).toBe(
      "vercel:deployment:dpl_test:deployment.error"
    );
    expect(canceledEvent.sourceId).toBe(
      "vercel:deployment:dpl_test:deployment.canceled"
    );
  });

  it("rejects event types outside the enum", () => {
    expect(() =>
      transformVercelDeployment(
        buildPayload("deployment.created"),
        context,
        "deployment.promoted"
      )
    ).toThrow();
  });
});
