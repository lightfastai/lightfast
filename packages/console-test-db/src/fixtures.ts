import { nanoid } from "@repo/lib";
import type {
  InsertGwInstallation,
  InsertGwToken,
  InsertGwResource,
} from "@db/console/schema";

/** Fixture types: like Insert types but with id guaranteed. */
export type InstallationFixture = InsertGwInstallation & { id: string };
export type TokenFixture = InsertGwToken & { id: string };
export type ResourceFixture = InsertGwResource & { id: string };

export const fixtures = {
  /**
   * Build a gwInstallations insert object with sensible defaults.
   * All fields can be overridden. The `id` field is always guaranteed to be a string.
   */
  installation(overrides?: Partial<InsertGwInstallation>): InstallationFixture {
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
   * Build a gwTokens insert object. Requires installationId FK.
   */
  token(
    overrides: Pick<InsertGwToken, "installationId"> & Partial<InsertGwToken>,
  ): TokenFixture {
    return {
      accessToken: `ghu_${nanoid()}`,
      ...overrides,
      id: overrides.id ?? nanoid(),
    };
  },

  /**
   * Build a gwResources insert object. Requires installationId FK.
   */
  resource(
    overrides: Pick<InsertGwResource, "installationId"> & Partial<InsertGwResource>,
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
