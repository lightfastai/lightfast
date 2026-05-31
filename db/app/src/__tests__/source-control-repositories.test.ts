import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import type {
  SourceControlRepository,
  SourceControlWebhookDelivery,
} from "../schema";
import {
  completeWatchedSourceControlRepositorySetup,
  markSourceControlWebhookDeliveryStatus,
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
      watchedPathGlobs: ["src/**"],
    });
    expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
      set: {
        fullName: "acme/project",
        watchedPathGlobs: ["src/**"],
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
      watchedPathGlobs: ["skills/**"],
    });
    expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
      set: {
        fullName: "acme/.lightfast",
        watchedPathGlobs: ["skills/**"],
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

function createWatchedRepository(
  overrides: Partial<SourceControlRepository> = {}
): SourceControlRepository {
  const now = new Date("2026-05-30T00:00:00.000Z");
  return {
    id: 1,
    orgSourceControlBindingId: 10,
    providerRepositoryId: "repo-1",
    fullName: "acme/project",
    watchedPathGlobs: ["src/**"],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
