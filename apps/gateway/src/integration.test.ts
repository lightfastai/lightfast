/**
 * Integration test proving @repo/console-test-db works end-to-end.
 *
 * Uses PGlite (in-memory Postgres) with real Drizzle migrations
 * instead of hollow chain mocks. Validates actual query logic.
 */

import {
  gatewayInstallations,
  gatewayResources,
  gatewayTokens,
} from "@db/console/schema";
import type { TestDb } from "@repo/console-test-db";
import { closeTestDb, createTestDb, resetTestDb } from "@repo/console-test-db";
import { fixtures } from "@repo/console-test-db/fixtures";
import { and, eq } from "@vendor/db";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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

describe("gatewayInstallations", () => {
  it("inserts and retrieves an installation", async () => {
    const inst = fixtures.installation({ provider: "github", orgId: "org-1" });
    await db.insert(gatewayInstallations).values(inst);

    const rows = await db
      .select()
      .from(gatewayInstallations)
      .where(eq(gatewayInstallations.id, inst.id));

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
    await db.insert(gatewayInstallations).values(inst);

    const duplicate = fixtures.installation({
      provider: "github",
      externalId: "ext-123",
    });

    await expect(
      db.insert(gatewayInstallations).values(duplicate)
    ).rejects.toThrow();
  });

  it("filters installations by orgId and provider", async () => {
    const inst1 = fixtures.installation({ provider: "github", orgId: "org-1" });
    const inst2 = fixtures.installation({ provider: "vercel", orgId: "org-1" });
    const inst3 = fixtures.installation({ provider: "github", orgId: "org-2" });
    await db.insert(gatewayInstallations).values([inst1, inst2, inst3]);

    const rows = await db
      .select()
      .from(gatewayInstallations)
      .where(
        and(
          eq(gatewayInstallations.orgId, "org-1"),
          eq(gatewayInstallations.provider, "github")
        )
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(inst1.id);
  });
});

describe("gatewayTokens", () => {
  it("inserts a token linked to an installation", async () => {
    const inst = fixtures.installation();
    await db.insert(gatewayInstallations).values(inst);

    const token = fixtures.token({ installationId: inst.id });
    await db.insert(gatewayTokens).values(token);

    const rows = await db
      .select()
      .from(gatewayTokens)
      .where(eq(gatewayTokens.installationId, inst.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.accessToken).toBe(token.accessToken);
  });

  it("cascades deletion from installation to tokens", async () => {
    const inst = fixtures.installation();
    await db.insert(gatewayInstallations).values(inst);

    const token = fixtures.token({ installationId: inst.id });
    await db.insert(gatewayTokens).values(token);

    await db
      .delete(gatewayInstallations)
      .where(eq(gatewayInstallations.id, inst.id));

    const remaining = await db
      .select()
      .from(gatewayTokens)
      .where(eq(gatewayTokens.id, token.id));

    expect(remaining).toHaveLength(0);
  });
});

describe("gatewayResources", () => {
  it("inserts a resource linked to an installation", async () => {
    const inst = fixtures.installation();
    await db.insert(gatewayInstallations).values(inst);

    const resource = fixtures.resource({
      installationId: inst.id,
      providerResourceId: "my-org/my-repo",
      resourceName: "my-repo",
    });
    await db.insert(gatewayResources).values(resource);

    const rows = await db
      .select()
      .from(gatewayResources)
      .where(eq(gatewayResources.installationId, inst.id));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.providerResourceId).toBe("my-org/my-repo");
    expect(rows[0]!.resourceName).toBe("my-repo");
  });

  it("cascades deletion from installation to resources", async () => {
    const inst = fixtures.installation();
    await db.insert(gatewayInstallations).values(inst);

    const res = fixtures.resource({ installationId: inst.id });
    await db.insert(gatewayResources).values(res);

    await db
      .delete(gatewayInstallations)
      .where(eq(gatewayInstallations.id, inst.id));

    const remaining = await db
      .select()
      .from(gatewayResources)
      .where(eq(gatewayResources.id, res.id));

    expect(remaining).toHaveLength(0);
  });
});

// These two tests must run sequentially (Vitest default within a describe).
// The first inserts data; the afterEach resetTestDb clears it; the second
// asserts the table is empty. Do not run in parallel or reorder.
describe("resetTestDb isolation", () => {
  it("first test inserts data", async () => {
    const inst = fixtures.installation({ orgId: "org-leak-check" });
    await db.insert(gatewayInstallations).values(inst);

    const rows = await db
      .select()
      .from(gatewayInstallations)
      .where(eq(gatewayInstallations.orgId, "org-leak-check"));

    expect(rows).toHaveLength(1);
  });

  it("second test sees empty table (proves reset works)", async () => {
    const rows = await db
      .select()
      .from(gatewayInstallations)
      .where(eq(gatewayInstallations.orgId, "org-leak-check"));

    expect(rows).toHaveLength(0);
  });
});
