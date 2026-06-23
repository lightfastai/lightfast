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
    "src/__tests__/team-members-service-boundary-source.test.ts"
  );
}

describe("team member service boundary", () => {
  it("pins team member sync imports to the concrete people-sync module", () => {
    const workflowSource = source("inngest/workflow/team-member-reconciler.ts");
    const workflowTestSource = source(
      "__tests__/team-member-reconciler-workflow.test.ts"
    );

    expect(workflowSource).toContain("../../services/team-members/people-sync");
    expect(workflowTestSource).toContain(
      "../services/team-members/people-sync"
    );
  });

  it("does not keep a broad team member service barrel", () => {
    expect(existsSync(resolve(apiRoot, "services/team-members/index.ts"))).toBe(
      false
    );
  });

  it("does not import the broad team member service path", () => {
    const bareSpecifierPattern =
      /(?:from|import|vi\.mock)\(\s*["'][^"']*services\/team-members["']\s*\)|\bfrom\s*["'][^"']*services\/team-members["']/;
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
