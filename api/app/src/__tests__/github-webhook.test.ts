import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getBindingMock = vi.fn();
const getWatchMock = vi.fn();
const markDeliveryMock = vi.fn();
const recordDeliveryMock = vi.fn();
const recordPrDeliveryMock = vi.fn();
const inngestSendMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getOrgBindingByProviderInstallation: getBindingMock,
  getWatchedSourceControlRepository: getWatchMock,
  markSourceControlWebhookDeliveryStatus: markDeliveryMock,
  recordSourceControlPrWebhookDelivery: recordPrDeliveryMock,
  recordSourceControlWebhookDeliveryReceived: recordDeliveryMock,
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
  commits: [
    {
      added: ["skills/demo/SKILL.md"],
      modified: [],
      removed: [],
    },
  ],
  installation: { id: 1001 },
  ref: "refs/heads/main",
  repository: {
    full_name: "lightfast-emulated/workspace",
    id: 2002,
    name: "workspace",
    owner: { login: "lightfast-emulated" },
  },
};

const pullRequestPayload = {
  action: "opened",
  installation: { id: 1001, node_id: "MDIzOkludGVncmF0aW9uMTAwMQ==" },
  pull_request: {
    id: 3003,
    number: 42,
    html_url:
      "https://github.lightfast.test/lightfast-emulated/workspace/pull/42",
  },
  repository: {
    full_name: "lightfast-emulated/workspace",
    id: 2002,
    name: "workspace",
    owner: { login: "lightfast-emulated" },
    visibility: "private",
  },
};

const issueCommentPayload = {
  action: "created",
  comment: { id: 7007, body: "Looks good" },
  installation: { id: 1001 },
  issue: {
    number: 42,
    pull_request: {
      url: "https://api.github.test/repos/lightfast-emulated/workspace/pulls/42",
    },
  },
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
    recordPrDeliveryMock.mockReset();
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
            "x-hub-signature-256": `sha256=${"0".repeat(64)}`,
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

  it("rejects signed push payloads with malformed routing fields before durable work", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");

    const res = await handleGitHubWebhook({
      request: signedRequest({
        ...pushPayload,
        after: "not-a-sha",
      }),
    });

    expect(res.status).toBe(400);
    expect(recordDeliveryMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
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

  it.each([
    "ignored",
    "failed",
    "processed",
  ] as const)("does not enqueue a duplicate terminal %s delivery", async (status) => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    recordDeliveryMock.mockResolvedValue({
      created: false,
      delivery: { status },
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(pushPayload),
    });

    expect(res.status).toBe(202);
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(markDeliveryMock).not.toHaveBeenCalled();
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
      syncStatus: "enabled",
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
      name: "app/github.repository.push.received",
      data: expect.objectContaining({
        afterSha: "a".repeat(40),
        changedPaths: ["skills/demo/SKILL.md"],
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
      syncStatus: "enabled",
      watchedPathGlobs: ["skills/**"],
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(pushPayload),
    });

    expect(res.status).toBe(202);
    expect(markDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        deliveryId: "delivery-1",
        status: "queued",
      }
    );
    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "app/github.repository.push.received",
      data: expect.objectContaining({
        afterSha: "a".repeat(40),
        changedPaths: ["skills/demo/SKILL.md"],
        deliveryId: "delivery-1",
        repositoryWatchId: 9,
      }),
    });
  });

  it("ignores watched repository pushes that do not touch watched paths", async () => {
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
      syncStatus: "enabled",
      watchedPathGlobs: ["skills/**"],
    });

    const res = await handleGitHubWebhook({
      request: signedRequest({
        ...pushPayload,
        commits: [
          {
            added: [],
            modified: ["docs/readme.md"],
            removed: [],
          },
        ],
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
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("queues watched main pushes when GitHub omits part of the commit list", async () => {
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
      syncStatus: "enabled",
      watchedPathGlobs: ["skills/**"],
    });

    const res = await handleGitHubWebhook({
      request: signedRequest({
        ...pushPayload,
        commits: [
          {
            added: [],
            modified: ["docs/readme.md"],
            removed: [],
          },
        ],
        size: 2,
      }),
    });

    expect(res.status).toBe(202);
    expect(inngestSendMock).toHaveBeenCalledWith({
      name: "app/github.repository.push.received",
      data: expect.objectContaining({
        changedPaths: ["docs/readme.md"],
        changedPathsComplete: false,
        deliveryId: "delivery-1",
        repositoryWatchId: 9,
      }),
    });
  });

  it("ignores disabled registered repository pushes without enqueueing", async () => {
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
      syncStatus: "disabled",
      watchedPathGlobs: null,
    });

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

  it("ignores PR events when the repository does not watch the event family", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    getBindingMock.mockResolvedValue({
      clerkOrgId: "org_123",
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      fullName: "lightfast-emulated/workspace",
      id: 9,
      providerRepositoryId: "2002",
      syncStatus: "enabled",
      watchedPathGlobs: ["skills/**"],
      watchedWebhookEvents: [],
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(
        pullRequestPayload,
        "delivery-pr-unwatched",
        "pull_request"
      ),
    });

    expect(res.status).toBe(202);
    expect(recordPrDeliveryMock).not.toHaveBeenCalled();
    expect(recordDeliveryMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("stores watched PR event raw payloads without checking sync status or path globs", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    getBindingMock.mockResolvedValue({
      clerkOrgId: "org_123",
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      fullName: "lightfast-emulated/workspace",
      id: 9,
      providerRepositoryId: "2002",
      syncStatus: "disabled",
      watchedPathGlobs: null,
      watchedWebhookEvents: ["pull_request"],
    });
    recordPrDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { deliveryId: "delivery-pr-1" },
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(
        pullRequestPayload,
        "delivery-pr-1",
        "pull_request"
      ),
    });

    expect(res.status).toBe(202);
    expect(recordPrDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        action: "opened",
        clerkOrgId: "org_123",
        deliveryId: "delivery-pr-1",
        event: "pull_request",
        orgSourceControlBindingId: 7,
        providerInstallationId: "1001",
        providerPullRequestId: "3003",
        providerRepositoryId: "2002",
        pullRequestNumber: 42,
        rawPayload: pullRequestPayload,
        sourceControlRepositoryId: 9,
      }
    );
    expect(recordDeliveryMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("stores watched PR-attached issue comments with nullable PR id", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    getBindingMock.mockResolvedValue({
      clerkOrgId: "org_123",
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      id: 9,
      providerRepositoryId: "2002",
      syncStatus: "enabled",
      watchedPathGlobs: ["**"],
      watchedWebhookEvents: ["issue_comment"],
    });
    recordPrDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { deliveryId: "delivery-issue-comment-1" },
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(
        issueCommentPayload,
        "delivery-issue-comment-1",
        "issue_comment"
      ),
    });

    expect(res.status).toBe(202);
    expect(recordPrDeliveryMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        event: "issue_comment",
        providerPullRequestId: null,
        pullRequestNumber: 42,
        rawPayload: issueCommentPayload,
      })
    );
  });

  it("ignores issue comments that are not attached to PRs", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    const res = await handleGitHubWebhook({
      request: signedRequest(
        {
          ...issueCommentPayload,
          issue: { number: 42 },
        },
        "delivery-issue-comment-non-pr",
        "issue_comment"
      ),
    });

    expect(res.status).toBe(202);
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(recordPrDeliveryMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed signed PR payloads before persistence", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    const res = await handleGitHubWebhook({
      request: signedRequest(
        {
          ...pullRequestPayload,
          pull_request: { id: 3003 },
        },
        "delivery-pr-malformed",
        "pull_request"
      ),
    });

    expect(res.status).toBe(400);
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(recordPrDeliveryMock).not.toHaveBeenCalled();
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
      syncStatus: "enabled",
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
    expect(inngestSendMock).not.toHaveBeenCalled();
  });
});
