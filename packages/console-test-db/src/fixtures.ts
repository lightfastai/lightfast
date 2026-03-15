import type {
  InsertGatewayInstallation,
  InsertGatewayResource,
  InsertGatewayToken,
} from "@db/console/schema";
import { nanoid } from "@repo/lib";

/** Fixture types: like Insert types but with id guaranteed. */
export type InstallationFixture = InsertGatewayInstallation & { id: string };
export type TokenFixture = InsertGatewayToken & { id: string };
export type ResourceFixture = InsertGatewayResource & { id: string };

export const fixtures = {
  /**
   * Build a gatewayInstallations insert object with sensible defaults.
   * All fields can be overridden. The `id` field is always guaranteed to be a string.
   */
  installation(overrides?: Partial<InsertGatewayInstallation>): InstallationFixture {
    return {
      provider: "github",
      externalId: nanoid(),
      connectedBy: `user_${nanoid()}`,
      orgId: `org_${nanoid()}`,
      status: "active",
      ...overrides,
      id: overrides?.id ?? nanoid(),
    };
  },

  /**
   * Build a gatewayTokens insert object. Requires installationId FK.
   */
  token(
    overrides: Pick<InsertGatewayToken, "installationId"> & Partial<InsertGatewayToken>
  ): TokenFixture {
    return {
      accessToken: `ghu_${nanoid()}`,
      ...overrides,
      id: overrides.id ?? nanoid(),
    };
  },

  /**
   * Build a gatewayResources insert object. Requires installationId FK.
   */
  resource(
    overrides: Pick<InsertGatewayResource, "installationId"> &
      Partial<InsertGatewayResource>
  ): ResourceFixture {
    return {
      providerResourceId: nanoid(),
      resourceName: `repo-${nanoid().slice(0, 8)}`,
      status: "active",
      ...overrides,
      id: overrides.id ?? nanoid(),
    };
  },
};
