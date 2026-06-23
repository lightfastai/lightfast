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
    "src/connectors/connectors-client.tsx",
    "src/decisions/decisions-client.tsx",
    "src/people/people-client.tsx",
    "src/people/people-detail-sheet.tsx",
  ];

  it("does not infer app query input types from server function call shape", () => {
    for (const path of queryFiles) {
      const source = appSource(path);

      expect(source).not.toContain("ServerFunctionData");
      expect(source).not.toContain("TFn extends");
    }
  });

  it("imports explicit input contracts from api/app TanStack adapters", () => {
    expect(appSource("src/people/people-client.tsx")).toContain(
      "type ListPeopleInput"
    );
    expect(appSource("src/people/people-detail-sheet.tsx")).toContain(
      "type GetPersonInput"
    );
    expect(appSource("src/connectors/connectors-client.tsx")).toContain(
      "type StartConnectorInput"
    );
    expect(appSource("src/connectors/connectors-client.tsx")).toContain(
      "type RefreshConnectorToolsInput"
    );
    expect(
      appSource("src/developer-connections/developer-connections-client.tsx")
    ).toContain("type ConnectDeveloperConnectionInput");
    expect(
      appSource("src/developer-connections/developer-connections-client.tsx")
    ).toContain("type StartSentryDeveloperConnectionAuthInput");
    expect(appSource("src/decisions/decisions-client.tsx")).toContain(
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
