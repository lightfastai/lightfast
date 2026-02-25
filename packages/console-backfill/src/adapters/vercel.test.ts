import { describe, it, expect } from "vitest";
import {
  adaptVercelDeploymentForTransformer,
  parseVercelRateLimit,
} from "./vercel";

function makeDeployment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: "dpl-abc123",
    name: "my-app",
    url: "my-app.vercel.app",
    projectId: "prj-xyz",
    readyState: "READY",
    created: 1700000000000,
    meta: {},
    ...overrides,
  };
}

describe("adaptVercelDeploymentForTransformer — readyState mapping (via adaptVercelDeploymentForTransformer)", () => {
  it('READY → eventType: "deployment.succeeded"', () => {
    const { eventType } = adaptVercelDeploymentForTransformer(makeDeployment({ readyState: "READY" }), "my-app");
    expect(eventType).toBe("deployment.succeeded");
  });

  it('ERROR → eventType: "deployment.error"', () => {
    const { eventType } = adaptVercelDeploymentForTransformer(makeDeployment({ readyState: "ERROR" }), "my-app");
    expect(eventType).toBe("deployment.error");
  });

  it('CANCELED → eventType: "deployment.canceled"', () => {
    const { eventType } = adaptVercelDeploymentForTransformer(makeDeployment({ readyState: "CANCELED" }), "my-app");
    expect(eventType).toBe("deployment.canceled");
  });

  it('BUILDING → eventType: "deployment.created"', () => {
    const { eventType } = adaptVercelDeploymentForTransformer(makeDeployment({ readyState: "BUILDING" }), "my-app");
    expect(eventType).toBe("deployment.created");
  });

  it('undefined readyState → eventType: "deployment.created"', () => {
    const { eventType } = adaptVercelDeploymentForTransformer(makeDeployment({ readyState: undefined }), "my-app");
    expect(eventType).toBe("deployment.created");
  });
});

describe("adaptVercelDeploymentForTransformer", () => {
  it('webhookPayload.id equals "backfill-{deployment.uid}"', () => {
    const { webhookPayload } = adaptVercelDeploymentForTransformer(makeDeployment({ uid: "dpl-test" }), "my-app");
    expect(webhookPayload.id).toBe("backfill-dpl-test");
  });

  it("webhookPayload.type matches mapped eventType", () => {
    const deployment = makeDeployment({ readyState: "ERROR" });
    const { webhookPayload, eventType } = adaptVercelDeploymentForTransformer(deployment, "my-app");
    expect(webhookPayload.type).toBe(eventType);
  });

  it("webhookPayload.createdAt equals deployment.created when present", () => {
    const { webhookPayload } = adaptVercelDeploymentForTransformer(makeDeployment({ created: 1700000000000 }), "my-app");
    expect(webhookPayload.createdAt).toBe(1700000000000);
  });

  it("webhookPayload.createdAt is roughly Date.now() when deployment.created is undefined", () => {
    const before = Date.now();
    const { webhookPayload } = adaptVercelDeploymentForTransformer(makeDeployment({ created: undefined }), "my-app");
    const after = Date.now();
    expect(webhookPayload.createdAt).toBeGreaterThanOrEqual(before);
    expect(webhookPayload.createdAt).toBeLessThanOrEqual(after);
  });

  it("webhookPayload.payload.deployment has id, name, url, readyState, meta from input", () => {
    const deployment = makeDeployment({ uid: "dpl-1", name: "app-1", url: "app.vercel.app", readyState: "READY", meta: { sha: "abc" } });
    const { webhookPayload } = adaptVercelDeploymentForTransformer(deployment, "my-app");
    expect(webhookPayload.payload.deployment).toMatchObject({
      id: "dpl-1",
      name: "app-1",
      url: "app.vercel.app",
      readyState: "READY",
      meta: { sha: "abc" },
    });
  });

  it("webhookPayload.payload.project has id and name from input", () => {
    const deployment = makeDeployment({ projectId: "prj-my" });
    const { webhookPayload } = adaptVercelDeploymentForTransformer(deployment, "my-project");
    expect(webhookPayload.payload.project).toMatchObject({
      id: "prj-my",
      name: "my-project",
    });
  });

  it("when projectName is passed, project.name equals projectName", () => {
    const { webhookPayload } = adaptVercelDeploymentForTransformer(makeDeployment(), "custom-name");
    expect(webhookPayload.payload.project!.name).toBe("custom-name");
  });

  it("function returns { webhookPayload, eventType } tuple", () => {
    const result = adaptVercelDeploymentForTransformer(makeDeployment(), "my-app");
    expect(result).toHaveProperty("webhookPayload");
    expect(result).toHaveProperty("eventType");
  });
});

describe("parseVercelRateLimit", () => {
  it("returns rate limit info from valid Headers object", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "99",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "100",
    });
    const result = parseVercelRateLimit(headers);
    expect(result).not.toBeUndefined();
    expect(result!.remaining).toBe(99);
    expect(result!.limit).toBe(100);
    expect(result!.resetAt).toEqual(new Date(1700000000 * 1000));
  });

  it("resetAt is Unix seconds multiplied by 1000 (same as GitHub adapter)", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "50",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "100",
    });
    const result = parseVercelRateLimit(headers);
    expect(result!.resetAt.getTime()).toBe(1700000000 * 1000);
  });

  it("returns undefined when x-ratelimit-remaining is missing", () => {
    const headers = new Headers({
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "100",
    });
    expect(parseVercelRateLimit(headers)).toBeUndefined();
  });

  it("returns undefined when x-ratelimit-reset is missing", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "99",
      "x-ratelimit-limit": "100",
    });
    expect(parseVercelRateLimit(headers)).toBeUndefined();
  });

  it("returns undefined when x-ratelimit-limit is missing", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "99",
      "x-ratelimit-reset": "1700000000",
    });
    expect(parseVercelRateLimit(headers)).toBeUndefined();
  });
});
