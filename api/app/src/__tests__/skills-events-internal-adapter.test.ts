import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSkillIndexEventStream: vi.fn(),
  db: { kind: "mock-db" },
  resolveAuthContextFromClerk: vi.fn(),
}));

vi.mock("@db/app/client", () => ({
  db: mocks.db,
}));

vi.mock("../auth/identity", () => ({
  resolveAuthContextFromClerk: mocks.resolveAuthContextFromClerk,
}));

vi.mock("../services/skills/events", () => ({
  createSkillIndexEventStream: mocks.createSkillIndexEventStream,
}));

const { handleSkillIndexEventsRequest } = await import(
  "../adapters/internal/skills-events"
);

describe("skills events internal adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSkillIndexEventStream.mockReturnValue(new ReadableStream());
  });

  it("returns 401 for unauthenticated requests", async () => {
    mocks.resolveAuthContextFromClerk.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await handleSkillIndexEventsRequest(createRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.createSkillIndexEventStream).not.toHaveBeenCalled();
  });

  it("returns 403 when a signed-in user has no active organization", async () => {
    mocks.resolveAuthContextFromClerk.mockResolvedValueOnce({
      identity: { type: "pending", userId: "user_123" },
    });

    const response = await handleSkillIndexEventsRequest(createRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Organization required",
    });
    expect(mocks.createSkillIndexEventStream).not.toHaveBeenCalled();
  });

  it("returns 403 when the active organization is not bound", async () => {
    mocks.resolveAuthContextFromClerk.mockResolvedValueOnce({
      identity: {
        orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github" },
        orgId: "org_unbound",
        type: "active",
        userId: "user_123",
      },
    });

    const response = await handleSkillIndexEventsRequest(createRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Organization setup required",
    });
    expect(mocks.createSkillIndexEventStream).not.toHaveBeenCalled();
  });

  it("opens an SSE stream for a bound active organization", async () => {
    const request = createRequest();
    const stream = new ReadableStream();
    mocks.createSkillIndexEventStream.mockReturnValueOnce(stream);
    mocks.resolveAuthContextFromClerk.mockResolvedValueOnce({
      identity: {
        orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
        orgId: "org_bound",
        type: "active",
        userId: "user_123",
      },
    });

    const response = await handleSkillIndexEventsRequest(request);

    expect(mocks.resolveAuthContextFromClerk).toHaveBeenCalledWith({
      db: mocks.db,
      headers: request.headers,
    });
    expect(mocks.createSkillIndexEventStream).toHaveBeenCalledWith({
      clerkOrgId: "org_bound",
      signal: request.signal,
    });
    expect(response.status).toBe(200);
    expect(response.body).toBe(stream);
    expect(response.headers.get("cache-control")).toBe(
      "no-store, no-cache, no-transform"
    );
    expect(response.headers.get("connection")).toBe("keep-alive");
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
  });
});

function createRequest() {
  return new Request("https://app.lightfast.localhost/api/skills/events", {
    headers: { authorization: "Bearer token_test" },
  });
}
