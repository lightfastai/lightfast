import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import type {
  SourceControlRepository,
  SourceControlWebhookDelivery,
} from "../schema";
import {
  markSourceControlWebhookDeliveryStatus,
  recordSourceControlWebhookDeliveryReceived,
  updateWatchedSourceControlRepositoryLastSeenSha,
  upsertWatchedSourceControlRepository,
} from "../utils/source-control-repositories";

describe("source-control repository helpers", () => {
  it("returns existing webhook delivery with created false after duplicate-key recovery", async () => {
    const delivery = createWebhookDelivery({ id: 20, deliveryId: "delivery-1" });
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
    const delivery = createWebhookDelivery({ id: 21, deliveryId: "delivery-2" });
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

  it("returns existing watched repository after duplicate-key recovery", async () => {
    const repository = createWatchedRepository({
      id: 30,
      providerRepositoryId: "repo-1",
    });
    const db = createSelectInsertDb({
      insertError: { body: { code: "ER_DUP_ENTRY" } },
      selectResults: [[], [repository]],
    });

    await expect(
      upsertWatchedSourceControlRepository(db, {
        fullName: "acme/project",
        orgSourceControlBindingId: 10,
        providerRepositoryId: "repo-1",
        watchedPathGlobs: ["src/**"],
      })
    ).resolves.toBe(repository);
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
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markSourceControlWebhookDeliveryStatus(db, {
        deliveryId: "delivery-1",
        status: "queued",
      })
    ).resolves.toBe(false);
  });

  it("updates only the watched repository last seen sha", async () => {
    const whereMock = vi.fn((_: SQL) => ({ affectedRows: 1 }));
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      updateWatchedSourceControlRepositoryLastSeenSha(db, {
        id: 10,
        lastSeenSha: "a".repeat(40),
      })
    ).resolves.toBe(true);

    expect(setMock).toHaveBeenCalledWith({ lastSeenSha: "a".repeat(40) });
    const condition = whereMock.mock.calls[0]?.[0];
    if (!condition) {
      throw new Error("expected update where condition");
    }
    const query = new MySqlDialect().sqlToQuery(condition);
    expect(query.sql).toContain("`id` = ?");
    expect(query.params).toContain(10);
  });

  it("returns false when updating watched repository last seen sha affects no rows", async () => {
    const whereMock = vi.fn((_: SQL) => ({ rowsAffected: 0 }));
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      updateWatchedSourceControlRepositoryLastSeenSha(db, {
        id: 10,
        lastSeenSha: "a".repeat(40),
      })
    ).resolves.toBe(false);
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
    lastSeenSha: null,
    lastProcessedSha: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
