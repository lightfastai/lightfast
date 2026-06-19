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
    "src/__tests__/identity-service-boundary-source.test.ts"
  );
}

describe("identity service boundary", () => {
  it("pins identity workflow imports to concrete service modules", () => {
    const classifyWorkflowSource = source(
      "inngest/workflow/classify-signal.ts"
    );
    const reconcileWorkflowSource = source(
      "inngest/workflow/reconcile-identity-indexes.ts"
    );
    const refreshWorkflowSource = source(
      "inngest/workflow/refresh-identity-index.ts"
    );

    expect(classifyWorkflowSource).toContain(
      "../../services/identity/runtime-context"
    );
    expect(reconcileWorkflowSource).toContain(
      "../../services/identity/reconcile"
    );
    expect(refreshWorkflowSource).toContain("../../services/identity/refresh");
  });

  it("pins identity service tests to concrete modules", () => {
    const indexServiceTestSource = source(
      "__tests__/identity-index-service.test.ts"
    );
    const runtimeContextTestSource = source(
      "__tests__/identity-runtime-context.test.ts"
    );
    const workflowsTestSource = source(
      "__tests__/skills-index-workflows.test.ts"
    );
    const signalWorkflowTestSource = source(
      "__tests__/signal-workflow.test.ts"
    );

    expect(indexServiceTestSource).toContain("../services/identity/build");
    expect(indexServiceTestSource).toContain("../services/identity/refresh");
    expect(runtimeContextTestSource).toContain(
      "../services/identity/runtime-context"
    );
    expect(workflowsTestSource).toContain("../services/identity/reconcile");
    expect(workflowsTestSource).toContain("../services/identity/refresh");
    expect(signalWorkflowTestSource).toContain(
      "../services/identity/runtime-context"
    );
  });

  it("does not keep a broad identity service barrel", () => {
    expect(existsSync(resolve(apiRoot, "services/identity/index.ts"))).toBe(
      false
    );
  });

  it("does not import the broad identity service path", () => {
    const bareSpecifierPatterns = [
      /\bfrom\s*["'`][^"'`]*services\/identity["'`]/,
      /\bimport\s*["'`][^"'`]*services\/identity["'`]/,
      /\bimport\(\s*["'`][^"'`]*services\/identity["'`]\s*\)/,
      /\bvi\.mock\(\s*["'`][^"'`]*services\/identity["'`]/,
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
