import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyMock = vi.fn();
const isOrgBoundMock = vi.fn();
const createOpportunityMock = vi.fn();
const getOpportunityByIdMock = vi.fn();
const markOpportunityFailedMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      apiKeys: { verify: verifyMock },
    }),
}));

vi.mock("@db/app/client", () => ({ db: { kind: "mock-db" } }));
vi.mock("@db/app", () => ({
  createOpportunity: createOpportunityMock,
  getOpportunityById: getOpportunityByIdMock,
  isOrgBound: isOrgBoundMock,
  markOpportunityFailed: markOpportunityFailedMock,
}));

vi.mock("../inngest/client", () => ({
  inngest: { send: sendMock },
}));

const { orpcRouter } = await import("../orpc/router");

const validKey = `ak_${"a".repeat(40)}`;

function apiKey(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "apk_test",
    type: "api_key",
    name: "test",
    subject: "org_test",
    scopes: [],
    claims: null,
    revoked: false,
    revocationReason: null,
    expired: false,
    expiration: null,
    createdBy: "user_test",
    description: null,
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function context() {
  return {
    headers: new Headers({ authorization: `Bearer ${validKey}` }),
    requestId: "test-req",
  };
}

beforeEach(() => {
  verifyMock.mockReset();
  isOrgBoundMock.mockReset();
  createOpportunityMock.mockReset();
  getOpportunityByIdMock.mockReset();
  markOpportunityFailedMock.mockReset();
  sendMock.mockReset();

  verifyMock.mockResolvedValue(apiKey());
  isOrgBoundMock.mockResolvedValue(true);
  createOpportunityMock.mockResolvedValue({
    id: "opp_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    status: "queued",
  });
  sendMock.mockResolvedValue(undefined);
});

describe("orpcRouter.opportunities", () => {
  it("creates a queued opportunity and sends an Inngest event", async () => {
    const result = await call(
      orpcRouter.opportunities.create,
      { input: "  Reply to this relevant post  " },
      { context: context() }
    );

    expect(result).toEqual({
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
    });
    expect(createOpportunityMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByApiKeyId: "apk_test",
      createdByUserId: "user_test",
      input: "Reply to this relevant post",
    });
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/opportunity.created",
      data: {
        clerkOrgId: "org_test",
        opportunityId: "opp_123e4567-e89b-12d3-a456-426614174000",
      },
    });
  });

  it("marks the opportunity failed when enqueueing the Inngest event fails", async () => {
    sendMock.mockRejectedValueOnce(new Error("inngest unavailable"));

    await expect(
      call(
        orpcRouter.opportunities.create,
        { input: "Run the test plan" },
        { context: context() }
      )
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: expect.stringContaining("Failed to queue opportunity"),
    });
    expect(markOpportunityFailedMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      errorCode: "INNGEST_ENQUEUE_FAILED",
      errorMessage: "inngest unavailable",
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("requires a bound org API key to create opportunities", async () => {
    isOrgBoundMock.mockResolvedValueOnce(false);

    await expect(
      call(
        orpcRouter.opportunities.create,
        { input: "Run the test plan" },
        { context: context() }
      )
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createOpportunityMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("reads a same-org opportunity by id", async () => {
    getOpportunityByIdMock.mockResolvedValueOnce({
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      createdByApiKeyId: "apk_test",
      input: "Run the test plan",
      status: "classified",
      classification: {
        schemaVersion: "opportunity.classification.v1",
        disposition: "actionable",
        title: "Run the test plan",
        summary: "The user needs to finish a validation task.",
        kind: "review",
        nextAction: "Run the PR test plan.",
        priority: "high",
        rationale: "The input describes unfinished validation work.",
        confidence: 0.95,
      },
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-05-21T00:00:00.000Z",
      updatedAt: "2026-05-21T00:01:00.000Z",
    });

    const result = await call(
      orpcRouter.opportunities.get,
      { id: "opp_123e4567-e89b-12d3-a456-426614174000" },
      { context: context() }
    );

    expect(getOpportunityByIdMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
    });
    expect(result).toMatchObject({
      id: "opp_123e4567-e89b-12d3-a456-426614174000",
      input: "Run the test plan",
      status: "classified",
      classification: { kind: "review" },
    });
  });

  it("returns NOT_FOUND for missing or wrong-org opportunities", async () => {
    getOpportunityByIdMock.mockResolvedValueOnce(undefined);

    await expect(
      call(
        orpcRouter.opportunities.get,
        { id: "opp_123e4567-e89b-12d3-a456-426614174000" },
        { context: context() }
      )
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
