import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org API key query helpers", () => {
  it("centralizes org API key query keys and server function calls", () => {
    const source = readFileSync(
      resolve(appRoot, "src/org/settings/api-keys/org-api-key-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/org-api-keys"');
    expect(source).toContain("orgApiKeyQueryKeys");
    expect(source).toContain("orgApiKeysQueryOptions");
    expect(source).toContain("createOrgApiKeyMutationOptions");
    expect(source).toContain("revokeOrgApiKeyMutationOptions");
    expect(source).toContain("deleteOrgApiKeyMutationOptions");
    expect(source).toContain("rotateOrgApiKeyMutationOptions");
    expect(source).not.toContain("useTRPC");
  });
});
