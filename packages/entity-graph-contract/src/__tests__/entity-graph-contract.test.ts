import { describe, expect, it } from "vitest";

import {
  ACCOUNT_TYPES,
  AFFILIATION_RELATIONSHIPS,
  accountTypeSchema,
  affiliationRelationshipSchema,
  ENTITY_GRAPH_STATUSES,
  entityGraphStatusSchema,
  OBSERVATION_STATUSES,
  observationStatusSchema,
  SOURCE_IDENTITY_PROVIDERS,
  SOURCE_IDENTITY_TYPES,
  sourceIdentityProviderSchema,
  sourceIdentityTypeSchema,
} from "../index";

describe("@repo/entity-graph-contract", () => {
  it("defines shared status vocabulary", () => {
    expect(ENTITY_GRAPH_STATUSES).toEqual([
      "possible",
      "likely",
      "confirmed",
      "conflicting",
      "rejected",
      "superseded",
    ]);
    expect(entityGraphStatusSchema.parse("confirmed")).toBe("confirmed");
    expect(entityGraphStatusSchema.safeParse("active").success).toBe(false);
  });

  it("defines account and affiliation vocabulary", () => {
    expect(ACCOUNT_TYPES).toEqual([
      "company",
      "personal_brand",
      "open_source_project",
      "community",
      "fund",
      "agency",
      "product",
      "unknown",
    ]);
    expect(AFFILIATION_RELATIONSHIPS).toEqual([
      "current",
      "historical",
      "founder",
      "employee",
      "advisor",
      "investor",
      "maintainer",
      "creator",
      "owner",
      "possible",
    ]);
    expect(accountTypeSchema.parse("company")).toBe("company");
    expect(affiliationRelationshipSchema.parse("historical")).toBe(
      "historical"
    );
  });

  it("defines durable source identity vocabulary", () => {
    expect(SOURCE_IDENTITY_PROVIDERS).toEqual([
      "x",
      "github",
      "gmail",
      "email",
      "domain",
      "website",
      "linkedin",
      "mcp",
    ]);
    expect(SOURCE_IDENTITY_TYPES).toEqual([
      "handle",
      "email",
      "profile_url",
      "domain",
      "url",
      "org_handle",
      "provider_account_id",
    ]);
    expect(sourceIdentityProviderSchema.parse("github")).toBe("github");
    expect(sourceIdentityTypeSchema.parse("domain")).toBe("domain");
  });

  it("keeps observation state separate from graph confidence state", () => {
    expect(OBSERVATION_STATUSES).toEqual(["active", "superseded"]);
    expect(observationStatusSchema.parse("active")).toBe("active");
    expect(observationStatusSchema.safeParse("likely").success).toBe(false);
  });
});
