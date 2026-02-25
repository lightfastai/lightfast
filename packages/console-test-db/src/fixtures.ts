import { nanoid } from "@repo/lib";
import type {
  InsertGwInstallation,
  InsertGwToken,
  InsertGwResource,
} from "@db/console/schema";

export const fixtures = {
  /**
   * Build a gwInstallations insert object with sensible defaults.
   * All fields can be overridden.
   */
  installation(overrides?: Partial<InsertGwInstallation>): InsertGwInstallation {
    return {
      id: nanoid(),
      provider: "github",
      externalId: nanoid(),
      connectedBy: `user_${nanoid()}` as InsertGwInstallation["connectedBy"],
      orgId: `org_${nanoid()}`,
      status: "active",
      ...overrides,
    };
  },

  /**
   * Build a gwTokens insert object. Requires installationId FK.
   */
  token(
    overrides: Pick<InsertGwToken, "installationId"> & Partial<InsertGwToken>,
  ): InsertGwToken {
    return {
      id: nanoid(),
      accessToken: `ghu_${nanoid()}`,
      ...overrides,
    };
  },

  /**
   * Build a gwResources insert object. Requires installationId FK.
   */
  resource(
    overrides: Pick<InsertGwResource, "installationId"> & Partial<InsertGwResource>,
  ): InsertGwResource {
    return {
      id: nanoid(),
      providerResourceId: nanoid(),
      resourceName: `repo-${nanoid().slice(0, 8)}`,
      status: "active",
      ...overrides,
    };
  },
};
