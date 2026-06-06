import { isClerkAPIResponseError } from "@vendor/clerk";

const CLERK_RESOURCE_NOT_FOUND = "resource_not_found";
const CLERK_ORGANIZATION_DOMAINS_NOT_ENABLED =
  "organization_domains_not_enabled";
const CLERK_CONFLICT_CODES = new Set([
  "duplicate_record",
  "form_identifier_exists",
]);

export function clerkErrorCodes(error: unknown): string[] {
  if (!isClerkAPIResponseError(error)) {
    return [];
  }
  return error.errors.map((entry) => entry.code).filter(Boolean);
}

export function hasClerkErrorCode(
  error: unknown,
  codes: ReadonlySet<string> | readonly string[]
): boolean {
  const expected = new Set(codes);
  return clerkErrorCodes(error).some((code) => expected.has(code));
}

export function isClerkResourceNotFound(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    (error.status === 404 ||
      hasClerkErrorCode(error, [CLERK_RESOURCE_NOT_FOUND]))
  );
}

export function isClerkConflictError(error: unknown): boolean {
  return hasClerkErrorCode(error, CLERK_CONFLICT_CODES);
}

export function isClerkOrganizationDomainsNotEnabled(error: unknown): boolean {
  return (
    isClerkAPIResponseError(error) &&
    error.status === 403 &&
    hasClerkErrorCode(error, [CLERK_ORGANIZATION_DOMAINS_NOT_ENABLED])
  );
}
