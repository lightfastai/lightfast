import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function repoJson<T>(path: string): T {
  return JSON.parse(repoSource(path)) as T;
}

describe("public OpenAPI contract source", () => {
  it("keeps signal status docs aligned with api-contract", () => {
    const openapi = repoJson<{
      components: {
        schemas: {
          SignalStatus: {
            enum: string[];
          };
        };
      };
    }>("apps/www/src/openapi.json");
    const signalContract = repoSource(
      "packages/api-contract/src/schemas/signals.ts"
    );
    const sdkDocs = repoSource("apps/www/src/content/docs/integrate/sdk.mdx");

    expect(signalContract).toContain('"classified"');
    expect(signalContract).not.toContain('"completed"');
    expect(openapi.components.schemas.SignalStatus.enum).toEqual([
      "queued",
      "processing",
      "classified",
      "failed",
    ]);
    expect(sdkDocs).toContain("classified");
    expect(sdkDocs).not.toContain("completed");
  });

  it("documents list signal items without entity links", () => {
    const openapi = repoJson<{
      components: {
        schemas: {
          ListSignalsOutputItem: unknown;
        };
      };
    }>("apps/www/src/openapi.json");
    const signalContract = repoSource(
      "packages/api-contract/src/schemas/signals.ts"
    );

    expect(signalContract).toContain(
      "export const listSignalsOutputItem = getSignalOutput.omit"
    );
    expect(signalContract).toContain("entityLinks: true");
    expect(openapi.components.schemas.ListSignalsOutputItem).not.toEqual({
      allOf: [{ $ref: "#/components/schemas/GetSignalOutput" }],
    });
    expect(
      JSON.stringify(openapi.components.schemas.ListSignalsOutputItem)
    ).not.toContain("entityLinks");
  });
});
