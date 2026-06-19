import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

function appSource(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("TanStack query input type boundaries", () => {
  const queryFiles = [
    "src/connectors/connectors-queries.ts",
    "src/decisions/decisions-queries.ts",
    "src/developer-connections/developer-connections-queries.ts",
    "src/people/people-queries.ts",
  ];

  it("does not infer app query input types from server function call shape", () => {
    for (const path of queryFiles) {
      const source = appSource(path);

      expect(source).not.toContain("ServerFunctionData");
      expect(source).not.toContain("TFn extends");
    }
  });

  it("imports explicit input contracts from api/app TanStack adapters", () => {
    expect(appSource("src/people/people-queries.ts")).toContain(
      "type ListPeopleInput"
    );
    expect(appSource("src/people/people-queries.ts")).toContain(
      "type GetPersonInput"
    );
    expect(appSource("src/connectors/connectors-queries.ts")).toContain(
      "type StartConnectorInput"
    );
    expect(appSource("src/connectors/connectors-queries.ts")).toContain(
      "type RefreshConnectorToolsInput"
    );
    expect(
      appSource("src/developer-connections/developer-connections-client.tsx")
    ).toContain("type ConnectDeveloperConnectionInput");
    expect(
      appSource("src/developer-connections/developer-connections-client.tsx")
    ).toContain("type StartSentryDeveloperConnectionAuthInput");
    expect(appSource("src/decisions/decisions-queries.ts")).toContain(
      "type ListDecisionsInput"
    );
  });

  it("exports explicit input contracts from api/app TanStack adapters", () => {
    expect(repoSource("api/app/src/adapters/tanstack/people.ts")).toContain(
      "export type ListPeopleInput"
    );
    expect(repoSource("api/app/src/adapters/tanstack/people.ts")).toContain(
      "export type GetPersonInput"
    );
    expect(repoSource("api/app/src/adapters/tanstack/connectors.ts")).toContain(
      "export type StartConnectorInput"
    );
    expect(repoSource("api/app/src/adapters/tanstack/connectors.ts")).toContain(
      "export type RefreshConnectorToolsInput"
    );
    expect(
      repoSource("api/app/src/adapters/tanstack/developer-connections.ts")
    ).toContain("export type ConnectDeveloperConnectionInput");
    expect(
      repoSource("api/app/src/adapters/tanstack/developer-connections.ts")
    ).toContain("export type StartSentryDeveloperConnectionAuthInput");
    expect(repoSource("api/app/src/adapters/tanstack/decisions.ts")).toContain(
      "export type ListDecisionsInput"
    );
  });
});
