import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBindingMock = vi.fn();
const getWatchMock = vi.fn();
const markDeliveryMock = vi.fn();
const recordDeliveryMock = vi.fn();
const updateLastSeenMock = vi.fn();
const inngestSendMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getOrgBindingByProviderInstallation: getBindingMock,
  getWatchedSourceControlRepository: getWatchMock,
  markSourceControlWebhookDeliveryStatus: markDeliveryMock,
  recordSourceControlWebhookDeliveryReceived: recordDeliveryMock,
  updateWatchedSourceControlRepositoryLastSeenSha: updateLastSeenMock,
}));

vi.mock("../env", () => ({
  env: {
    GITHUB_APP_WEBHOOK_SECRET: "secret",
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
  },
}));

function signedRequest(
  payload: unknown,
  deliveryId = "delivery-1",
  event = "push"
) {
  const body = JSON.stringify(payload);
  const signature = `sha256=${createHmac("sha256", "secret")
    .update(body)
    .digest("hex")}`;
  return new Request("https://app.lightfast.localhost/api/github/webhook", {
    body,
    headers: {
      "content-type": "application/json",
      "x-github-delivery": deliveryId,
      "x-github-event": event,
      "x-hub-signature-256": signature,
    },
    method: "POST",
  });
}

const pushPayload = {
  after: "a".repeat(40),
  before: "b".repeat(40),
  installation: { id: 1001 },
  ref: "refs/heads/main",
  repository: {
    full_name: "lightfast-emulated/workspace",
    id: 2002,
    name: "workspace",
    owner: { login: "lightfast-emulated" },
  },
};

describe("handleGitHubWebhook", () => {
  beforeEach(() => {
    getBindingMock.mockReset();
    getWatchMock.mockReset();
    markDeliveryMock.mockReset();
    recordDeliveryMock.mockReset();
    updateLastSeenMock.mockReset();
    inngestSendMock.mockReset();
  });

  it("rejects invalid signatures before durable work", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    const res = await handleGitHubWebhook({
      request: new Request(
        "https://app.lightfast.localhost/api/github/webhook",
        {
          body: JSON.stringify(pushPayload),
          headers: {
            "x-github-delivery": "delivery-1",
            "x-github-event": "push",
            "x-hub-signature-256": "sha256=bad",
          },
          method: "POST",
        }
      ),
    });

    expect(res.status).toBe(401);
    expect(recordDeliveryMock).not.toHaveBeenCalled();
  });

  it("rejects missing signatures as unauthorized before durable work", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    const res = await handleGitHubWebhook({
      request: new Request(
        "https://app.lightfast.localhost/api/github/webhook",
        {
          body: JSON.stringify(pushPayload),
          headers: {
            "x-github-delivery": "delivery-1",
            "x-github-event": "push",
          },
          method: "POST",
        }
      ),
    });

    expect(res.status).toBe(401);
    expect(recordDeliveryMock).not.toHaveBeenCalled();
  });

  it("returns 400 for signed malformed JSON", async () => {
    const body = "{";
    const signature = `sha256=${createHmac("sha256", "secret")
      .update(body)
      .digest("hex")}`;
    const { handleGitHubWebhook } = await import("../services/github/webhook");

    const res = await handleGitHubWebhook({
      request: new Request(
        "https://app.lightfast.localhost/api/github/webhook",
        {
          body,
          headers: {
            "x-github-delivery": "delivery-1",
            "x-github-event": "push",
            "x-hub-signature-256": signature,
          },
          method: "POST",
        }
      ),
    });

    expect(res.status).toBe(400);
    expect(recordDeliveryMock).not.toHaveBeenCalled();
  });

  it("ignores signed unsupported events without durable work", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");

    const res = await handleGitHubWebhook({
      request: signedRequest({ action: "opened" }, "delivery-issues", "issues"),
    });

    expect(res.status).toBe(202);
    expect(recordDeliveryMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("does not enqueue a duplicate queued delivery", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: false,
      delivery: { status: "queued" },
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(pushPayload),
    });

    expect(res.status).toBe(202);
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("continues processing a duplicate received delivery retry", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: false,
      delivery: { status: "received" },
    });
    getBindingMock.mockResolvedValue({
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      fullName: "lightfast-emulated/workspace",
      id: 9,
      providerRepositoryId: "2002",
      watchedPathGlobs: ["skills/**"],
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(pushPayload),
    });

    expect(res.status).toBe(202);
    expect(getBindingMock).toHaveBeenCalledWith(
      {},
      {
        provider: "github",
        providerInstallationId: "1001",
      }
    );
    expect(getWatchMock).toHaveBeenCalledWith(
      {},
      {
        orgSourceControlBindingId: 7,
        providerRepositoryId: "2002",
      }
    );
    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "app/source-control.repository.push.received",
      data: expect.objectContaining({
        deliveryId: "delivery-1",
        repositoryWatchId: 9,
      }),
    });
  });

  it("marks unbound installation deliveries ignored", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { status: "received" },
    });
    getBindingMock.mockResolvedValue(undefined);

    const res = await handleGitHubWebhook({
      request: signedRequest(pushPayload),
    });

    expect(res.status).toBe(202);
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "ignored",
      }
    );
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("marks unwatched repository deliveries ignored", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { status: "received" },
    });
    getBindingMock.mockResolvedValue({
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue(undefined);

    const res = await handleGitHubWebhook({
      request: signedRequest(pushPayload),
    });

    expect(res.status).toBe(202);
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "ignored",
      }
    );
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("queues watched repository pushes once", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { status: "received" },
    });
    getBindingMock.mockResolvedValue({
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      fullName: "lightfast-emulated/workspace",
      id: 9,
      providerRepositoryId: "2002",
      watchedPathGlobs: ["skills/**"],
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(pushPayload),
    });

    expect(res.status).toBe(202);
    expect(updateLastSeenMock).toHaveBeenCalledWith(
      {},
      {
        id: 9,
        lastSeenSha: "a".repeat(40),
      }
    );
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "queued",
      }
    );
    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "app/source-control.repository.push.received",
      data: expect.objectContaining({
        deliveryId: "delivery-1",
        repositoryWatchId: 9,
      }),
    });
  });

  it("does not mark queued when enqueue fails", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { status: "received" },
    });
    getBindingMock.mockResolvedValue({
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      fullName: "lightfast-emulated/workspace",
      id: 9,
      providerRepositoryId: "2002",
      watchedPathGlobs: ["skills/**"],
    });
    inngestSendMock.mockRejectedValue(new Error("enqueue failed"));

    await expect(
      handleGitHubWebhook({
        request: signedRequest(pushPayload),
      })
    ).rejects.toThrow("enqueue failed");

    expect(markDeliveryMock).not.toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "queued",
      }
    );
  });

  it("ignores deleted branch pushes without enqueueing", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { status: "received" },
    });

    const res = await handleGitHubWebhook({
      request: signedRequest({
        ...pushPayload,
        after: "0".repeat(40),
      }),
    });

    expect(res.status).toBe(202);
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "ignored",
      }
    );
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(updateLastSeenMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
  });
});
