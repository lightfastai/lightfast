import type { Database, PeopleView } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import {
  createPeopleView,
  deletePeopleView,
  listPeopleViews,
} from "../utils/people-views";

function makeView(overrides: Partial<PeopleView> = {}): PeopleView {
  return {
    id: 1,
    publicId: "peoview_123e4567-e89b-12d3-a456-426614174000",
    clerkOrgId: "org_test",
    createdByUserId: "user_test",
    name: "X handles",
    config: {
      filters: {
        providers: ["x"],
        types: ["handle"],
      },
    },
    createdAt: new Date("2026-05-31T01:00:00.000Z"),
    updatedAt: new Date("2026-05-31T01:00:00.000Z"),
    ...overrides,
  };
}

function makeListDb(rows: PeopleView[]) {
  const spies = {
    where: vi.fn(),
    orderBy: vi.fn(() => Promise.resolve(rows)),
  };
  const db = {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          spies.where(condition);
          return { orderBy: spies.orderBy };
        },
      }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

function makeCreateDb() {
  let inserted: Partial<PeopleView> | null = null;
  const spies = {
    values: vi.fn(async (value: Partial<PeopleView>) => {
      inserted = value;
    }),
    limit: vi.fn(() =>
      Promise.resolve(inserted ? [makeView({ ...inserted, id: 9 })] : [])
    ),
  };
  const db = {
    insert: () => ({ values: spies.values }),
    select: () => ({
      from: () => ({ where: () => ({ limit: spies.limit }) }),
    }),
  };
  return { db: db as unknown as Database, spies };
}

function makeDeleteDb(rowsAffected: number) {
  const spies = {
    where: vi.fn(async () => ({ rowsAffected })),
  };
  const db = { delete: () => ({ where: spies.where }) };
  return { db: db as unknown as Database, spies };
}

describe("listPeopleViews", () => {
  it("returns the caller's views newest-first", async () => {
    const rows = [makeView({ id: 2 }), makeView({ id: 1 })];
    const { db, spies } = makeListDb(rows);

    await expect(
      listPeopleViews(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
      })
    ).resolves.toEqual(rows);
    expect(spies.where).toHaveBeenCalledOnce();
    expect(spies.orderBy).toHaveBeenCalled();
  });
});

describe("createPeopleView", () => {
  it("inserts a view scoped to the org + user and returns it", async () => {
    const { db, spies } = makeCreateDb();

    await expect(
      createPeopleView(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        name: "X handles",
        config: makeView().config,
      })
    ).resolves.toMatchObject({
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      name: "X handles",
    });

    expect(spies.values).toHaveBeenCalledWith(
      expect.objectContaining({
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        name: "X handles",
      })
    );
  });
});

describe("deletePeopleView", () => {
  it("returns true when a row was deleted", async () => {
    const { db } = makeDeleteDb(1);
    await expect(
      deletePeopleView(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: "peoview_123e4567-e89b-12d3-a456-426614174000",
      })
    ).resolves.toBe(true);
  });

  it("returns false when nothing matched", async () => {
    const { db } = makeDeleteDb(0);
    await expect(
      deletePeopleView(db, {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: "peoview_missing",
      })
    ).resolves.toBe(false);
  });
});
