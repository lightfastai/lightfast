import { ClerkAPIResponseError } from "@vendor/clerk";
import { describe, expect, it } from "vitest";

import {
  isClerkConflictError,
  isClerkOrganizationDomainsNotEnabled,
  isClerkResourceNotFound,
} from "../auth/clerk-errors";

function clerkError(status: number, code: string, message = "Clerk error") {
  return new ClerkAPIResponseError("FAPI error", {
    clerkTraceId: "trace_test",
    data: [{ code, message, long_message: message }],
    retryAfter: undefined,
    status,
  });
}

describe("Clerk error helpers", () => {
  it("recognizes Clerk resource-not-found responses using Clerk's native guard", () => {
    expect(isClerkResourceNotFound(clerkError(404, "resource_not_found"))).toBe(
      true
    );
  });

  it("does not accept plain objects that only mimic Clerk's error shape", () => {
    expect(
      isClerkResourceNotFound({
        errors: [{ code: "resource_not_found" }],
        status: 404,
      })
    ).toBe(false);
  });

  it("recognizes Clerk duplicate-organization responses by Clerk error code", () => {
    expect(isClerkConflictError(clerkError(422, "duplicate_record"))).toBe(
      true
    );
    expect(
      isClerkConflictError(clerkError(422, "form_identifier_exists"))
    ).toBe(true);
  });

  it("does not classify arbitrary Clerk validation messages as conflicts", () => {
    expect(
      isClerkConflictError(
        clerkError(422, "form_param_format_invalid", "slug is taken")
      )
    ).toBe(false);
  });

  it("recognizes Clerk organization-domain feature responses", () => {
    expect(
      isClerkOrganizationDomainsNotEnabled(
        clerkError(
          403,
          "organization_domains_not_enabled",
          "organization domains not enabled"
        )
      )
    ).toBe(true);
  });
});
