import { describe, expect, it } from "vitest";
import {
  createDeveloperConnectionId,
  createDeveloperConnectionLeaseId,
  DEVELOPER_CONNECTION_ID_PREFIX,
  DEVELOPER_CONNECTION_LEASE_ID_PREFIX,
  developerConnectionLeases,
  developerConnections,
} from "../schema";
import {
  currentDeveloperConnectionKey,
  developerConnectionLeaseExpiresAt,
  issueDeveloperConnectionLease,
  markCurrentDeveloperConnectionNeedsReconnect,
  replaceCurrentDeveloperConnection,
  revokeDeveloperConnectionLease,
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
    expect(developerConnections.clerkOrgId.notNull).toBe(true);
    expect(developerConnections.currentOrgProviderKey.notNull).toBe(false);
    expect(developerConnections.provider.notNull).toBe(true);
    expect(developerConnections.status.notNull).toBe(true);
    expect(developerConnections.enabledForSandboxes.notNull).toBe(true);
    expect(developerConnections.encryptedCredential.notNull).toBe(false);
    expect(developerConnections.lastUsedAt.notNull).toBe(false);
    expect(developerConnections.lastUsedByUserId.notNull).toBe(false);
    expect(developerConnections.revokedAt.notNull).toBe(false);
  });

  it("exports lease rows without credential payload fields", () => {
    expect(developerConnectionLeases.clerkOrgId.notNull).toBe(true);
    expect(developerConnectionLeases.actorUserId.notNull).toBe(true);
    expect(developerConnectionLeases.provider.notNull).toBe(true);
    expect(developerConnectionLeases.status.notNull).toBe(true);
    expect(developerConnectionLeases.expiresAt.notNull).toBe(true);
    expect("encryptedCredential" in developerConnectionLeases).toBe(false);
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
    expect(typeof markCurrentDeveloperConnectionNeedsReconnect).toBe("function");
    expect(typeof issueDeveloperConnectionLease).toBe("function");
    expect(typeof revokeDeveloperConnectionLease).toBe("function");
  });
});
