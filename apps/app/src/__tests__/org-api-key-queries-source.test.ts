import { existsSync, readFileSync } from "node:fs";
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

  it("keeps API key create mutation state in the create component", () => {
    const createSource = readFileSync(
      resolve(appRoot, "src/org/settings/api-keys/org-api-key-create.tsx"),
      "utf8"
    );
    const actionsPath =
      "src/org/settings/api-keys/org-api-key-create-action.ts";

    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(createSource).toContain("useMutation");
    expect(createSource).toContain("useQueryClient");
    expect(createSource).toContain("createOrgApiKeyMutationOptions");
    expect(createSource).not.toContain("useOrgApiKeyCreateAction");
    expect(createSource).not.toContain("org-api-key-create-action");
  });
});
