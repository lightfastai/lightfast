import { describe, expect, it } from "vitest";
import {
  createDeveloperConnectionId,
  createDeveloperConnectionLeaseId,
  DEVELOPER_CONNECTION_ID_PREFIX,
  DEVELOPER_CONNECTION_LEASE_ID_PREFIX,
  developerConnectionLeases,
  developerConnections,
} from "../schema";

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
