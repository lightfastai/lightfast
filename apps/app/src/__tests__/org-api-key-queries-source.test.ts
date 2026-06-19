import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("org API key query helpers", () => {
  it("keeps the list query local while sharing cache key and row types", () => {
    const queriesPath = "src/org/settings/api-keys/org-api-key-queries.ts";
    const cacheSource = readFileSync(
      resolve(appRoot, "src/org/settings/api-keys/org-api-key-cache.ts"),
      "utf8"
    );
    const listSource = readFileSync(
      resolve(appRoot, "src/org/settings/api-keys/org-api-key-list.tsx"),
      "utf8"
    );

    expect(existsSync(resolve(appRoot, queriesPath))).toBe(false);
    expect(cacheSource).toContain(
      'import type { ListOrgApiKeysResult } from "@api/app/tanstack/org-api-keys"'
    );
    expect(cacheSource).toContain("orgApiKeyListQueryKey");
    expect(listSource).toContain('@api/app/tanstack/org-api-keys"');
    expect(listSource).toContain("listOrgApiKeys");
    expect(listSource).toContain("queryFn: () => listOrgApiKeys()");
    expect(listSource).toContain("queryKey: orgApiKeyListQueryKey");
    expect(listSource).not.toContain("orgApiKeysQueryOptions");
    expect(listSource).not.toContain("orgApiKeyQueryKeys");
    expect(listSource).not.toContain("useTRPC");
  });

  it("keeps API key create mutation state in the create component", () => {
    const createSource = readFileSync(
      resolve(appRoot, "src/org/settings/api-keys/org-api-key-create.tsx"),
      "utf8"
    );
    const actionsPath =
      "src/org/settings/api-keys/org-api-key-create-action.ts";

    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(createSource).toContain('@api/app/tanstack/org-api-keys"');
    expect(createSource).toContain("createOrgApiKey");
    expect(createSource).toContain("useMutation");
    expect(createSource).toContain("useQueryClient");
    expect(createSource).not.toContain("createOrgApiKeyMutationOptions");
    expect(createSource).not.toContain("useOrgApiKeyCreateAction");
    expect(createSource).not.toContain("org-api-key-create-action");
  });

  it("keeps API key list mutation state in the list component", () => {
    const listSource = readFileSync(
      resolve(appRoot, "src/org/settings/api-keys/org-api-key-list.tsx"),
      "utf8"
    );
    const actionsPath = "src/org/settings/api-keys/org-api-key-list-actions.ts";

    expect(existsSync(resolve(appRoot, actionsPath))).toBe(false);
    expect(listSource).toContain('@api/app/tanstack/org-api-keys"');
    expect(listSource).toContain("revokeOrgApiKey");
    expect(listSource).toContain("deleteOrgApiKey");
    expect(listSource).toContain("rotateOrgApiKey");
    expect(listSource).toContain("useMutation");
    expect(listSource).toContain("useQueryClient");
    expect(listSource).not.toContain("revokeOrgApiKeyMutationOptions");
    expect(listSource).not.toContain("deleteOrgApiKeyMutationOptions");
    expect(listSource).not.toContain("rotateOrgApiKeyMutationOptions");
    expect(listSource).toContain("orgApiKeyListQueryKey");
    expect(listSource).toContain("revokeApiKey");
    expect(listSource).toContain("removeApiKey");
    expect(listSource).toContain("restoreApiKey");
    expect(listSource).not.toContain("useOrgApiKeyListActions");
    expect(listSource).not.toContain("org-api-key-list-actions");
  });
});
