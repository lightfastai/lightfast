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
    "src/__tests__/entity-enrichment-service-boundary-source.test.ts"
  );
}

describe("entity enrichment service boundary", () => {
  it("pins enrichment workflow imports to concrete service modules", () => {
    const workflowSource = source("inngest/workflow/enrich-signal-entities.ts");
    const workflowTestSource = source(
      "__tests__/signal-entity-enrichment-workflow.test.ts"
    );
    const adapterTestSource = source(
      "__tests__/entity-enrichment-adapters.test.ts"
    );

    expect(workflowSource).toContain(
      "../../services/entity-enrichment/provider-fetchers"
    );
    expect(workflowSource).toContain(
      "../../services/entity-enrichment/adapters"
    );
    expect(workflowSource).toContain("../../services/entity-enrichment/ids");
    expect(workflowTestSource).toContain(
      "../services/entity-enrichment/provider-fetchers"
    );
    expect(workflowTestSource).toContain(
      "../services/entity-enrichment/adapters"
    );
    expect(workflowTestSource).toContain("../services/entity-enrichment/ids");
    expect(adapterTestSource).toContain(
      "../services/entity-enrichment/adapters"
    );
    expect(adapterTestSource).toContain("../services/entity-enrichment/ids");
  });

  it("does not keep a broad entity enrichment service barrel", () => {
    expect(
      existsSync(resolve(apiRoot, "services/entity-enrichment/index.ts"))
    ).toBe(false);
  });

  it("does not import the broad entity enrichment service path", () => {
    const bareSpecifierPatterns = [
      /\bfrom\s*["'][^"']*services\/entity-enrichment["']/,
      /\bimport\s*["'][^"']*services\/entity-enrichment["']/,
      /\bimport\(\s*["'][^"']*services\/entity-enrichment["']\s*\)/,
      /\bvi\.mock\(\s*["'][^"']*services\/entity-enrichment["']/,
    ];
    const offenders = sourceFiles()
      .filter((path) => !isThisTestFile(path))
      .map((path) => ({
        path: relative(apiRoot, path),
        source: readFileSync(path, "utf8"),
      }))
      .filter(({ source }) =>
        bareSpecifierPatterns.some((pattern) => pattern.test(source))
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});
