import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

function sourceFiles(dir = apiRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absPath = resolve(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(absPath);
    }

    return /\.(?:ts|tsx)$/.test(entry.name) ? [absPath] : [];
  });
}

function isThisTestFile(path: string) {
  return path.endsWith(
    "src/__tests__/user-connectors-service-boundary-source.test.ts"
  );
}

describe("user connector service boundary", () => {
  it("pins user connector catalog imports to the concrete app adapter/service modules", () => {
    const connectorCommandsSource = source("domain/connectors/commands.ts");
    const connectorAdapterSource = source("adapters/tanstack/connectors.ts");
    const connectorCommandsTestSource = source(
      "__tests__/connectors-domain-commands.test.ts"
    );
    const userConnectorsFlowTestSource = source(
      "__tests__/user-connectors-flow.test.ts"
    );

    expect(connectorCommandsSource).not.toContain(
      "../../services/user-connectors/catalog"
    );
    expect(connectorAdapterSource).toContain(
      "../../services/user-connectors/catalog"
    );
    expect(connectorCommandsSource).not.toMatch(
      /\bfrom\s*["']\.\.\/\.\.\/services\/user-connectors["']/
    );
    expect(connectorCommandsTestSource).toContain(
      "../services/user-connectors/catalog"
    );
    expect(userConnectorsFlowTestSource).toContain(
      "../services/user-connectors/catalog"
    );
  });

  it("does not keep a broad user connector service barrel", () => {
    expect(
      existsSync(resolve(apiRoot, "services/user-connectors/index.ts"))
    ).toBe(false);
  });

  it("does not import the broad user connector service path", () => {
    const bareSpecifierPattern =
      /(?:from|import|vi\.mock)\(\s*["'][^"']*services\/user-connectors["']\s*\)|\bfrom\s*["'][^"']*services\/user-connectors["']/;
    const offenders = sourceFiles()
      .filter((path) => !isThisTestFile(path))
      .map((path) => ({
        path: relative(apiRoot, path),
        source: readFileSync(path, "utf8"),
      }))
      .filter(({ source }) => bareSpecifierPattern.test(source))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});
