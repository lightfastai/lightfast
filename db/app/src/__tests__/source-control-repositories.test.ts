import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import type {
  SourceControlPrWebhookDelivery,
  SourceControlRepository,
  SourceControlWebhookDelivery,
} from "../schema";
import {
  completeWatchedSourceControlRepositorySetup,
  getSourceControlPrWebhookDeliveryByDeliveryId,
  insertWatchedSourceControlRepository,
  listWatchedSourceControlRepositories,
  markSourceControlWebhookDeliveryStatus,
  recordSourceControlPrWebhookDelivery,
  recordSourceControlWebhookDeliveryReceived,
  upsertWatchedSourceControlRepository,
} from "../utils/source-control-repositories";

describe("source-control repository helpers", () => {
  it("returns existing webhook delivery with created false after duplicate-key recovery", async () => {
    const delivery = createWebhookDelivery({
      id: 20,
      deliveryId: "delivery-1",
    });
    const db = createSelectInsertDb({
      insertError: { code: "ER_DUP_ENTRY" },
      selectResults: [[], [delivery]],
    });

    await expect(
      recordSourceControlWebhookDeliveryReceived(db, {
        deliveryId: "delivery-1",
        event: "push",
        providerInstallationId: "installation-1",
        providerRepositoryId: "repo-1",
      })
    ).resolves.toEqual({ delivery, created: false });
  });

  it("returns inserted webhook delivery with created true", async () => {
    const delivery = createWebhookDelivery({
      id: 21,
      deliveryId: "delivery-2",
    });
    const db = createSelectInsertDb({
      selectResults: [[], [delivery]],
    });

    await expect(
      recordSourceControlWebhookDeliveryReceived(db, {
        deliveryId: "delivery-2",
        event: "push",
        providerInstallationId: "installation-1",
        providerRepositoryId: "repo-1",
      })
    ).resolves.toEqual({ delivery, created: true });
  });

  it("returns inserted PR webhook delivery with created true", async () => {
    const delivery = createPrWebhookDelivery({
      id: 101,
      deliveryId: "delivery-pr-1",
    });
    const db = createSelectInsertDb({
      selectResults: [[], [delivery]],
    });

    await expect(
      recordSourceControlPrWebhookDelivery(db, {
        action: "opened",
        clerkOrgId: "org_123",
        deliveryId: "delivery-pr-1",
        event: "pull_request",
        orgSourceControlBindingId: 7,
        providerInstallationId: "1001",
        providerPullRequestId: "3003",
        providerRepositoryId: "2002",
        pullRequestNumber: 42,
        rawPayload: { action: "opened" },
        sourceControlRepositoryId: 9,
      })
    ).resolves.toEqual({ delivery, created: true });
  });

  it("returns existing PR webhook delivery with created false after duplicate-key recovery", async () => {
    const delivery = createPrWebhookDelivery({
      id: 102,
      deliveryId: "delivery-pr-2",
    });
    const db = createSelectInsertDb({
      insertError: { code: "ER_DUP_ENTRY" },
      selectResults: [[], [delivery]],
    });

    await expect(
      recordSourceControlPrWebhookDelivery(db, {
        action: "edited",
        clerkOrgId: "org_123",
        deliveryId: "delivery-pr-2",
        event: "issue_comment",
        orgSourceControlBindingId: 7,
        providerInstallationId: "1001",
        providerPullRequestId: null,
        providerRepositoryId: "2002",
        pullRequestNumber: 42,
        rawPayload: { action: "edited" },
        sourceControlRepositoryId: 9,
      })
    ).resolves.toEqual({ delivery, created: false });
  });

  it("gets PR webhook deliveries by delivery id", async () => {
    const delivery = createPrWebhookDelivery({
      deliveryId: "delivery-pr-3",
    });
    const db = createSelectInsertDb({
      selectResults: [[delivery]],
    });

    await expect(
      getSourceControlPrWebhookDeliveryByDeliveryId(db, {
        deliveryId: "delivery-pr-3",
      })
    ).resolves.toBe(delivery);
  });

  it("upserts watched repository and returns the stored row", async () => {
    const repository = createWatchedRepository({
      id: 30,
      providerRepositoryId: "repo-1",
    });
    const limitMock = vi.fn(() => [repository]);
    const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: selectWhereMock }));
    const onDuplicateKeyUpdateMock = vi.fn(() => Promise.resolve());
    const valuesMock = vi.fn(() => ({
      onDuplicateKeyUpdate: onDuplicateKeyUpdateMock,
    }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => ({ from: fromMock })),
    } as unknown as Database;

    await expect(
      upsertWatchedSourceControlRepository(db, {
        fullName: "acme/project",
        orgSourceControlBindingId: 10,
        providerRepositoryId: "repo-1",
        watchedPathGlobs: ["src/**"],
      })
    ).resolves.toBe(repository);

    expect(valuesMock).toHaveBeenCalledWith({
      fullName: "acme/project",
      orgSourceControlBindingId: 10,
      providerRepositoryId: "repo-1",
      syncStatus: "enabled",
      watchedPathGlobs: ["src/**"],
      watchedWebhookEvents: [],
    });
    expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
      set: {
        fullName: "acme/project",
        syncStatus: "enabled",
        watchedPathGlobs: ["src/**"],
        watchedWebhookEvents: [],
      },
    });
  });

  it("lists watched repositories for a binding", async () => {
    const repositories = [
      createWatchedRepository({
        id: 30,
        orgSourceControlBindingId: 7,
        providerRepositoryId: "repo-1",
      }),
    ];
    const whereMock = vi.fn(() => repositories);
    const orderByMock = vi.fn(() => ({ where: whereMock }));
    const fromMock = vi.fn(() => ({ orderBy: orderByMock }));
    const db = {
      select: vi.fn(() => ({ from: fromMock })),
    } as unknown as Database;

    await expect(
      listWatchedSourceControlRepositories(db, {
        orgSourceControlBindingId: 7,
      })
    ).resolves.toEqual(repositories);
  });

  it("inserts registered repository without watch globs", async () => {
    const repository = createWatchedRepository({
      fullName: "acme/workspace",
      id: 31,
      providerRepositoryId: "repo-2",
      watchedPathGlobs: null,
    });
    const limitMock = vi.fn(() => [repository]);
    const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: selectWhereMock }));
    const catchMock = vi.fn(async () => undefined);
    const valuesMock = vi.fn(() => ({ catch: catchMock }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => ({ from: fromMock })),
    } as unknown as Database;

    await expect(
      insertWatchedSourceControlRepository(db, {
        fullName: "acme/workspace",
        orgSourceControlBindingId: 7,
        providerRepositoryId: "repo-2",
        syncStatus: "disabled",
        watchedPathGlobs: null,
      })
    ).resolves.toBe(repository);

    expect(valuesMock).toHaveBeenCalledWith({
      fullName: "acme/workspace",
      orgSourceControlBindingId: 7,
      providerRepositoryId: "repo-2",
      syncStatus: "disabled",
      watchedPathGlobs: null,
      watchedWebhookEvents: [],
    });
  });

  it("stores explicit watched webhook events on repository upsert", async () => {
    const repository = createWatchedRepository({
      id: 32,
      providerRepositoryId: "repo-3",
      watchedWebhookEvents: ["pull_request", "issue_comment"],
    });
    const limitMock = vi.fn(() => [repository]);
    const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: selectWhereMock }));
    const onDuplicateKeyUpdateMock = vi.fn(() => Promise.resolve());
    const valuesMock = vi.fn(() => ({
      onDuplicateKeyUpdate: onDuplicateKeyUpdateMock,
    }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => ({ from: fromMock })),
    } as unknown as Database;

    await expect(
      upsertWatchedSourceControlRepository(db, {
        fullName: "acme/project",
        orgSourceControlBindingId: 10,
        providerRepositoryId: "repo-3",
        watchedPathGlobs: null,
        watchedWebhookEvents: ["pull_request", "issue_comment"],
      })
    ).resolves.toBe(repository);

    expect(valuesMock).toHaveBeenCalledWith({
      fullName: "acme/project",
      orgSourceControlBindingId: 10,
      providerRepositoryId: "repo-3",
      syncStatus: "enabled",
      watchedPathGlobs: null,
      watchedWebhookEvents: ["pull_request", "issue_comment"],
    });
    expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
      set: {
        fullName: "acme/project",
        syncStatus: "enabled",
        watchedPathGlobs: null,
        watchedWebhookEvents: ["pull_request", "issue_comment"],
      },
    });
  });

  it("stores repository proof metadata and watch in one transaction", async () => {
    const repository = createWatchedRepository({
      id: 30,
      fullName: "acme/.lightfast",
      orgSourceControlBindingId: 7,
      providerRepositoryId: "987",
      watchedPathGlobs: ["skills/**"],
    });
    const selectResults = [[repository]];
    const limitMock = vi.fn(() => selectResults.shift() ?? []);
    const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: selectWhereMock }));
    const bindingWhereMock = vi.fn((_: SQL) => ({ affectedRows: 1 }));
    const bindingSetMock = vi.fn(() => ({ where: bindingWhereMock }));
    const onDuplicateKeyUpdateMock = vi.fn(() => Promise.resolve());
    const valuesMock = vi.fn(() => ({
      onDuplicateKeyUpdate: onDuplicateKeyUpdateMock,
    }));
    const tx = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => ({ from: fromMock })),
      update: vi.fn(() => ({ set: bindingSetMock })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;
    const bindingMetadata = {
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "987",
        installationId: "1001",
        name: ".lightfast",
        verifiedAt: "2026-05-30T10:00:00.000Z",
      },
    };

    await expect(
      completeWatchedSourceControlRepositorySetup(db, {
        bindingMetadata,
        fullName: "acme/.lightfast",
        orgSourceControlBindingId: 7,
        providerRepositoryId: "987",
        watchedPathGlobs: ["skills/**"],
      })
    ).resolves.toBe(repository);

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(bindingSetMock).toHaveBeenCalledWith({ metadata: bindingMetadata });
    expect(valuesMock).toHaveBeenCalledWith({
      fullName: "acme/.lightfast",
      orgSourceControlBindingId: 7,
      providerRepositoryId: "987",
      syncStatus: "enabled",
      watchedPathGlobs: ["skills/**"],
      watchedWebhookEvents: [],
    });
    expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
      set: {
        fullName: "acme/.lightfast",
        syncStatus: "enabled",
        watchedPathGlobs: ["skills/**"],
        watchedWebhookEvents: [],
      },
    });
    const condition = bindingWhereMock.mock.calls[0]?.[0];
    if (!condition) {
      throw new Error("expected binding update where condition");
    }
    const query = new MySqlDialect().sqlToQuery(condition);
    expect(query.sql).toContain("`id` = ?");
    expect(query.sql).toContain("`status` = ?");
    expect(query.params).toEqual(expect.arrayContaining([7, "active"]));
  });

  it("does not create a watch when repository proof metadata cannot be stored", async () => {
    const bindingWhereMock = vi.fn((_: SQL) => ({ affectedRows: 0 }));
    const bindingSetMock = vi.fn(() => ({ where: bindingWhereMock }));
    const tx = {
      insert: vi.fn(),
      update: vi.fn(() => ({ set: bindingSetMock })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      completeWatchedSourceControlRepositorySetup(db, {
        bindingMetadata: {},
        fullName: "acme/.lightfast",
        orgSourceControlBindingId: 7,
        providerRepositoryId: "987",
        watchedPathGlobs: ["skills/**"],
      })
    ).rejects.toThrow(/binding 7/);

    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("does not treat array-wrapped zero-row metadata updates as success", async () => {
    const bindingWhereMock = vi.fn((_: SQL) => [{ affectedRows: 0 }]);
    const bindingSetMock = vi.fn(() => ({ where: bindingWhereMock }));
    const tx = {
      insert: vi.fn(),
      update: vi.fn(() => ({ set: bindingSetMock })),
    };
    const db = {
      transaction: vi.fn(async (callback: (value: typeof tx) => unknown) =>
        callback(tx)
      ),
    } as unknown as Database;

    await expect(
      completeWatchedSourceControlRepositorySetup(db, {
        bindingMetadata: {},
        fullName: "acme/.lightfast",
        orgSourceControlBindingId: 7,
        providerRepositoryId: "987",
        watchedPathGlobs: ["skills/**"],
      })
    ).rejects.toThrow(/binding 7/);

    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("marks webhook delivery status by delivery id", async () => {
    const whereMock = vi.fn((_: SQL) => ({ affectedRows: 1 }));
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markSourceControlWebhookDeliveryStatus(db, {
        deliveryId: "delivery-1",
        status: "queued",
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith({ status: "queued" });
    const condition = whereMock.mock.calls[0]?.[0];
    if (!condition) {
      throw new Error("expected update where condition");
    }
    const query = new MySqlDialect().sqlToQuery(condition);
    expect(query.sql).toContain("`delivery_id` = ?");
    expect(query.params).toContain("delivery-1");
  });

  it("returns false when marking webhook delivery status affects no rows", async () => {
    const whereMock = vi.fn((_: SQL) => ({ affectedRows: 0 }));
    const setMock = vi.fn(() => ({ where: whereMock }));
    const limitMock = vi.fn(() => []);
    const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: selectWhereMock }));
    const db = {
      select: vi.fn(() => ({ from: fromMock })),
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markSourceControlWebhookDeliveryStatus(db, {
        deliveryId: "delivery-1",
        status: "queued",
      })
    ).resolves.toBe(false);
  });

  it("returns true when marking webhook delivery status is already applied", async () => {
    const whereMock = vi.fn((_: SQL) => ({ affectedRows: 0 }));
    const setMock = vi.fn(() => ({ where: whereMock }));
    const limitMock = vi.fn(() => [
      createWebhookDelivery({ deliveryId: "delivery-1", status: "queued" }),
    ]);
    const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: selectWhereMock }));
    const db = {
      select: vi.fn(() => ({ from: fromMock })),
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markSourceControlWebhookDeliveryStatus(db, {
        deliveryId: "delivery-1",
        status: "queued",
      })
    ).resolves.toBe(true);
  });
});

function createSelectInsertDb(input: {
  insertError?: unknown;
  selectResults: unknown[][];
}): Database {
  const selectResults = [...input.selectResults];
  const limitMock = vi.fn(() => selectResults.shift() ?? []);
  const whereMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const valuesMock = input.insertError
    ? vi.fn(() => Promise.reject(input.insertError))
    : vi.fn(() => Promise.resolve());

  return {
    insert: vi.fn(() => ({ values: valuesMock })),
    select: vi.fn(() => ({ from: fromMock })),
  } as unknown as Database;
}

function createWebhookDelivery(
  overrides: Partial<SourceControlWebhookDelivery> = {}
): SourceControlWebhookDelivery {
  const now = new Date("2026-05-30T00:00:00.000Z");
  return {
    id: 1,
    deliveryId: "delivery-1",
    event: "push",
    providerInstallationId: "installation-1",
    providerRepositoryId: "repo-1",
    status: "received",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createPrWebhookDelivery(
  overrides: Partial<SourceControlPrWebhookDelivery> = {}
): SourceControlPrWebhookDelivery {
  const now = new Date("2026-06-06T00:00:00.000Z");
  return {
    id: 1,
    action: "opened",
    clerkOrgId: "org_123",
    deliveryId: "delivery-pr-1",
    event: "pull_request",
    orgSourceControlBindingId: 7,
    providerInstallationId: "1001",
    providerPullRequestId: "3003",
    providerRepositoryId: "2002",
    pullRequestNumber: 42,
    rawPayload: { action: "opened" },
    sourceControlRepositoryId: 9,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createWatchedRepository(
  overrides: Partial<SourceControlRepository> = {}
): SourceControlRepository {
  const now = new Date("2026-05-30T00:00:00.000Z");
  return {
    id: 1,
    orgSourceControlBindingId: 10,
    providerRepositoryId: "repo-1",
    fullName: "acme/project",
    syncStatus: "enabled",
    watchedPathGlobs: ["src/**"],
    watchedWebhookEvents: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
