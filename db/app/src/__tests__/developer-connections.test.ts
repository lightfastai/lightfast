import { describe, expect, it } from "vitest";
import {
  createDeveloperConnectionId,
  createDeveloperConnectionLeaseId,
  DEVELOPER_CONNECTION_ID_PREFIX,
  DEVELOPER_CONNECTION_LEASE_ID_PREFIX,
  orgDeveloperConnectionLeases,
  orgDeveloperConnections,
} from "../schema";
import {
  currentDeveloperConnectionKey,
  developerConnectionLeaseExpiresAt,
  issueDeveloperConnectionLease,
  listDeveloperConnectionLeasesForSandboxRun,
  markCurrentDeveloperConnectionNeedsReconnect,
  markDeveloperConnectionLeaseMaterialized,
  replaceCurrentDeveloperConnection,
  revokeDeveloperConnectionLease,
  revokeDeveloperConnectionLeasesForSandboxRun,
  setCurrentDeveloperConnectionSandboxEnabled,
} from "../utils/developer-connections";

describe("developer connection schema", () => {
  it("creates public ids with stable prefixes", () => {
    expect(createDeveloperConnectionId()).toMatch(
      /^developer_connection_[0-9a-f-]{36}$/
    );
    expect(createDeveloperConnectionLeaseId()).toMatch(
      /^developer_connection_lease_[0-9a-f-]{36}$/
    );
    expect(DEVELOPER_CONNECTION_ID_PREFIX).toBe("developer_connection_");
    expect(DEVELOPER_CONNECTION_LEASE_ID_PREFIX).toBe(
      "developer_connection_lease_"
    );
  });

  it("exports the current connection fields required by the service", () => {
    expect(orgDeveloperConnections.clerkOrgId.notNull).toBe(true);
    expect(orgDeveloperConnections.currentOrgProviderKey.notNull).toBe(false);
    expect(orgDeveloperConnections.provider.notNull).toBe(true);
    expect(orgDeveloperConnections.status.notNull).toBe(true);
    expect(orgDeveloperConnections.enabledForSandboxes.notNull).toBe(true);
    expect(orgDeveloperConnections.encryptedCredential.notNull).toBe(false);
    expect(orgDeveloperConnections.lastUsedAt.notNull).toBe(false);
    expect(orgDeveloperConnections.lastUsedByUserId.notNull).toBe(false);
    expect(orgDeveloperConnections.revokedAt.notNull).toBe(false);
  });

  it("exports lease rows without credential payload fields", () => {
    expect(orgDeveloperConnectionLeases.clerkOrgId.notNull).toBe(true);
    expect(orgDeveloperConnectionLeases.actorUserId.notNull).toBe(true);
    expect(orgDeveloperConnectionLeases.provider.notNull).toBe(true);
    expect(orgDeveloperConnectionLeases.status.notNull).toBe(true);
    expect(orgDeveloperConnectionLeases.expiresAt.notNull).toBe(true);
    expect("encryptedCredential" in orgDeveloperConnectionLeases).toBe(false);
  });
});

describe("developer connection helpers", () => {
  it("creates current keys by org and provider", () => {
    expect(currentDeveloperConnectionKey("org_123", "pscale")).toBe(
      "org_123:pscale"
    );
  });

  it("caps lease expiry at 30 minutes and defaults to 15 minutes", () => {
    const now = new Date("2026-06-03T00:00:00.000Z");

    expect(developerConnectionLeaseExpiresAt(now).toISOString()).toBe(
      "2026-06-03T00:15:00.000Z"
    );
    expect(
      developerConnectionLeaseExpiresAt(now, 45 * 60 * 1000).toISOString()
    ).toBe("2026-06-03T00:30:00.000Z");
  });

  it("exports helper functions used by services", () => {
    expect(typeof replaceCurrentDeveloperConnection).toBe("function");
    expect(typeof setCurrentDeveloperConnectionSandboxEnabled).toBe("function");
    expect(typeof markCurrentDeveloperConnectionNeedsReconnect).toBe(
      "function"
    );
    expect(typeof issueDeveloperConnectionLease).toBe("function");
    expect(typeof listDeveloperConnectionLeasesForSandboxRun).toBe("function");
    expect(typeof markDeveloperConnectionLeaseMaterialized).toBe("function");
    expect(typeof revokeDeveloperConnectionLease).toBe("function");
    expect(typeof revokeDeveloperConnectionLeasesForSandboxRun).toBe(
      "function"
    );
  });
});
