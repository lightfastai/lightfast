import { beforeEach, describe, expect, it, vi } from "vitest";

const createSkillIndexEventStreamMock = vi.fn();
const resolveAuthContextFromClerkMock = vi.fn();

vi.mock("@api/app/auth/identity", () => ({
  resolveAuthContextFromClerk: resolveAuthContextFromClerkMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock(
  "~/app/(api)/api/skills/index/events/skill-index-event-stream",
  () => ({
    createSkillIndexEventStream: createSkillIndexEventStreamMock,
  })
);

const { GET } = await import("~/app/(api)/api/skills/index/events/route");

beforeEach(() => {
  createSkillIndexEventStreamMock.mockReset();
  resolveAuthContextFromClerkMock.mockReset();
  resolveAuthContextFromClerkMock.mockResolvedValue({
    identity: {
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
      orgId: "org_123",
      type: "active",
      userId: "user_123",
    },
  });
});

describe("skill index events route", () => {
  it("opens an event stream for an active bound organization", async () => {
    const stream = new ReadableStream<Uint8Array>();
    createSkillIndexEventStreamMock.mockReturnValueOnce(stream);

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(createSkillIndexEventStreamMock).toHaveBeenCalledWith({
      clerkOrgId: "org_123",
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects unauthenticated callers", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(createSkillIndexEventStreamMock).not.toHaveBeenCalled();
  });

  it("rejects pending callers", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: { type: "pending", userId: "user_123" },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(403);
    expect(createSkillIndexEventStreamMock).not.toHaveBeenCalled();
  });

  it("rejects active callers without a bound organization", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: {
        orgGate: { bindingStatus: "unbound", nextSetupRequirement: "bind" },
        orgId: "org_123",
        type: "active",
        userId: "user_123",
      },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(403);
    expect(createSkillIndexEventStreamMock).not.toHaveBeenCalled();
  });
});

function createRequest() {
  return new Request("https://app.lightfast.localhost/api/skills/index/events");
}
