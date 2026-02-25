/**
 * Integration test proving @repo/console-test-db works end-to-end.
 *
 * Uses PGlite (in-memory Postgres) with real Drizzle migrations
 * instead of hollow chain mocks. Validates actual query logic.
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import {
  createTestDb,
  resetTestDb,
  closeTestDb,
} from "@repo/console-test-db";
import type { TestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import { eq, and } from "drizzle-orm";
import {
  gwInstallations,
  gwTokens,
  gwResources,
} from "@db/console/schema";

let db: TestDb;

beforeAll(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe("gwInstallations", () => {
  it("inserts and retrieves an installation", async () => {
    const inst = fixtures.installation({ provider: "github", orgId: "org-1" });
    await db.insert(gwInstallations).values(inst);

    const rows = await db
      .select()
      .from(gwInstallations)
      .where(eq(gwInstallations.id, inst.id!));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe("github");
    expect(rows[0]!.orgId).toBe("org-1");
    expect(rows[0]!.status).toBe("active");
  });

  it("enforces unique provider+externalId constraint", async () => {
    const inst = fixtures.installation({
      provider: "github",
      externalId: "ext-123",
    });
    await db.insert(gwInstallations).values(inst);

    const duplicate = fixtures.installation({
      provider: "github",
      externalId: "ext-123",
    });

    await expect(
      db.insert(gwInstallations).values(duplicate),
    ).rejects.toThrow();
  });

  it("filters installations by orgId and provider", async () => {
    const inst1 = fixtures.installation({ provider: "github", orgId: "org-1" });
    const inst2 = fixtures.installation({ provider: "vercel", orgId: "org-1" });
    const inst3 = fixtures.installation({ provider: "github", orgId: "org-2" });
    await db.insert(gwInstallations).values([inst1, inst2, inst3]);

    const rows = await db
      .select()
      .from(gwInstallations)
      .where(
        and(
          eq(gwInstallations.orgId, "org-1"),
          eq(gwInstallations.provider, "github"),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(inst1.id);
  });
});

describe("gwTokens", () => {
  it("inserts a token linked to an installation", async () => {
    const inst = fixtures.installation();
    await db.insert(gwInstallations).values(inst);

    const token = fixtures.token({ installationId: inst.id! });
    await db.insert(gwTokens).values(token);

    const rows = await db
      .select()
      .from(gwTokens)
      .where(eq(gwTokens.installationId, inst.id!));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.accessToken).toBe(token.accessToken);
  });

  it("cascades deletion from installation to tokens", async () => {
    const inst = fixtures.installation();
    await db.insert(gwInstallations).values(inst);

    const token = fixtures.token({ installationId: inst.id! });
    await db.insert(gwTokens).values(token);

    await db
      .delete(gwInstallations)
      .where(eq(gwInstallations.id, inst.id!));

    const remaining = await db
      .select()
      .from(gwTokens)
      .where(eq(gwTokens.id, token.id!));

    expect(remaining).toHaveLength(0);
  });
});

describe("gwResources", () => {
  it("inserts a resource linked to an installation", async () => {
    const inst = fixtures.installation();
    await db.insert(gwInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id!,
      providerResourceId: "my-org/my-repo",
      resourceName: "my-repo",
    });
    await db.insert(gwResources).values(resource);

    const rows = await db
      .select()
      .from(gwResources)
      .where(eq(gwResources.installationId, inst.id!));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.providerResourceId).toBe("my-org/my-repo");
    expect(rows[0]!.resourceName).toBe("my-repo");
  });

  it("cascades deletion from installation to resources", async () => {
    const inst = fixtures.installation();
    await db.insert(gwInstallations).values(inst);

    const res = fixtures.resource({ installationId: inst.id! });
    await db.insert(gwResources).values(res);

    await db
      .delete(gwInstallations)
      .where(eq(gwInstallations.id, inst.id!));

    const remaining = await db
      .select()
      .from(gwResources)
      .where(eq(gwResources.id, res.id!));

    expect(remaining).toHaveLength(0);
  });
});

// These two tests must run sequentially (Vitest default within a describe).
// The first inserts data; the afterEach resetTestDb clears it; the second
// asserts the table is empty. Do not run in parallel or reorder.
describe("resetTestDb isolation", () => {
  it("first test inserts data", async () => {
    const inst = fixtures.installation({ orgId: "org-leak-check" });
    await db.insert(gwInstallations).values(inst);

    const rows = await db
      .select()
      .from(gwInstallations)
      .where(eq(gwInstallations.orgId, "org-leak-check"));

    expect(rows).toHaveLength(1);
  });

  it("second test sees empty table (proves reset works)", async () => {
    const rows = await db
      .select()
      .from(gwInstallations)
      .where(eq(gwInstallations.orgId, "org-leak-check"));

    expect(rows).toHaveLength(0);
  });
});
