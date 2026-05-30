import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import {
  markSourceControlWebhookDeliveryStatus,
  updateWatchedSourceControlRepositoryLastSeenSha,
} from "../utils/source-control-repositories";

describe("source-control repository helpers", () => {
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
});
