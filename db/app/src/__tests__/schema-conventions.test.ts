import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

interface DrizzleJournal {
  entries: Array<{ idx: number; tag: string }>;
}

interface DrizzleSnapshot {
  tables: Record<
    string,
    {
      columns: Record<string, { default?: string; type: string }>;
      indexes: Record<string, unknown>;
      foreignKeys: Record<string, unknown>;
      compositePrimaryKeys: Record<string, { columns: string[] }>;
    }
  >;
}

const WORKSPACE_ROOT = join(process.cwd(), "..", "..");
const SKIPPED_DIRECTORIES = new Set([
  ".cache",
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);
const SOURCE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;

function latestSnapshot(): DrizzleSnapshot {
  const migrationsDir = join(process.cwd(), "src/migrations");
  const journal = JSON.parse(
    readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8")
  ) as DrizzleJournal;
  const latest = journal.entries.at(-1);

  if (!latest) {
    throw new Error("Expected at least one Drizzle migration journal entry.");
  }

  const snapshotName = `${String(latest.idx).padStart(4, "0")}_snapshot.json`;
  return JSON.parse(
    readFileSync(join(migrationsDir, "meta", snapshotName), "utf8")
  ) as DrizzleSnapshot;
}

function workspaceFiles(startDir = WORKSPACE_ROOT): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(startDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...workspaceFiles(join(startDir, entry.name)));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(join(startDir, entry.name));
    }
  }

  return files;
}

describe("schema conventions", () => {
  it("uses scope-first app table names with unsigned bigint id primary keys", () => {
    const snapshot = latestSnapshot();
    const tableNamePattern =
      /^lightfast_(org|user|system)_[a-z0-9]+(?:_[a-z0-9]+)*$/;
    const violations: string[] = [];

    for (const [tableName, table] of Object.entries(snapshot.tables)) {
      const primaryKeyColumns = Object.values(
        table.compositePrimaryKeys
      ).flatMap((primaryKey) => primaryKey.columns);

      if (!tableNamePattern.test(tableName)) {
        violations.push(`${tableName}: missing lightfast_<scope>_ prefix`);
      }

      if (primaryKeyColumns.length !== 1 || primaryKeyColumns[0] !== "id") {
        violations.push(`${tableName}: primary key is not id`);
      }

      if (table.columns.id?.type !== "bigint unsigned") {
        violations.push(`${tableName}: id is not bigint unsigned`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("uses scope-first schema table file names", () => {
    const tablesDir = join(process.cwd(), "src/schema/tables");
    const allowedFiles = [
      "index.ts",
      "org-automations.ts",
      "org-connectors.ts",
      "org-developer-connections.ts",
      "org-developer-sandbox-runs.ts",
      "org-entity-graph.ts",
      "org-identity-index.ts",
      "org-people-views.ts",
      "org-people.ts",
      "org-provider-routine-calls.ts",
      "org-signal-views.ts",
      "org-signals.ts",
      "org-skill-index.ts",
      "org-source-control-bindings.ts",
      "org-source-control-repositories.ts",
      "org-workspace-assistant.ts",
      "system-mcp-oauth.ts",
      "system-namespaces.ts",
      "user-source-control.ts",
    ];

    const actualFiles = readdirSync(tablesDir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.startsWith("_"))
      .sort();

    expect(actualFiles).toEqual(allowedFiles);
  });

  it("does not define SQL foreign keys in app schema", () => {
    const snapshot = latestSnapshot();
    const tablesWithForeignKeys = Object.entries(snapshot.tables)
      .filter(([, table]) => Object.keys(table.foreignKeys).length > 0)
      .map(([tableName]) => tableName);

    expect(tablesWithForeignKeys).toEqual([]);
  });

  it("uses scoped snake-case index names within MySQL limits", () => {
    const snapshot = latestSnapshot();
    const indexNamePattern =
      /^(org|user|system)_[a-z0-9]+(?:_[a-z0-9]+)*_(idx|uq)$/;
    const violations: string[] = [];

    for (const [tableName, table] of Object.entries(snapshot.tables)) {
      const scope = /^lightfast_(org|user|system)_/.exec(tableName)?.[1];

      for (const indexName of Object.keys(table.indexes)) {
        if (indexName.length > 64) {
          violations.push(`${indexName}: longer than 64 characters`);
        }

        if (!indexNamePattern.test(indexName)) {
          violations.push(`${indexName}: missing scoped _idx/_uq name`);
        }

        if (scope && !indexName.startsWith(`${scope}_`)) {
          violations.push(`${indexName}: does not match ${tableName} scope`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("uses datetime(3) for every app-owned time column", () => {
    const snapshot = latestSnapshot();
    const violations: string[] = [];

    for (const [tableName, table] of Object.entries(snapshot.tables)) {
      for (const [columnName, column] of Object.entries(table.columns)) {
        if (
          /(?:_at|_until)$/.test(columnName) &&
          column.type !== "datetime(3)"
        ) {
          violations.push(`${tableName}.${columnName}: ${column.type}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps timestamp defaults and runtime updated-at hooks aligned", () => {
    const snapshot = latestSnapshot();
    const tablesDir = join(process.cwd(), "src/schema/tables");
    const violations: string[] = [];

    for (const [tableName, table] of Object.entries(snapshot.tables)) {
      if (
        table.columns.created_at &&
        table.columns.created_at.default !== "CURRENT_TIMESTAMP(3)"
      ) {
        violations.push(`${tableName}.created_at: missing default`);
      }

      if (
        table.columns.updated_at &&
        table.columns.updated_at.default !== "CURRENT_TIMESTAMP(3)"
      ) {
        violations.push(`${tableName}.updated_at: missing default`);
      }
    }

    for (const file of readdirSync(tablesDir)) {
      if (
        !file.endsWith(".ts") ||
        file.startsWith("_") ||
        file === "index.ts"
      ) {
        continue;
      }

      const source = readFileSync(join(tablesDir, file), "utf8");
      const updatedAtDeclarations =
        source.match(/updatedAt:\s*datetime\("updated_at"/g) ?? [];
      const updatedAtHooks =
        source.match(
          /updatedAt:\s*datetime\("updated_at",\s*\{\s*mode:\s*"date",\s*fsp:\s*3\s*\}\)[\s\S]*?\.\$onUpdate\(\(\) => new Date\(\)\)[\s\S]*?\.notNull\(\)/g
        ) ?? [];

      if (updatedAtDeclarations.length !== updatedAtHooks.length) {
        violations.push(`${file}: updatedAt missing runtime hook`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps timestamp builders and DDL on-update clauses out of table sources", () => {
    const tablesDir = join(process.cwd(), "src/schema/tables");
    const offenders = readdirSync(tablesDir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.startsWith("_"))
      .flatMap((file) => {
        const source = readFileSync(join(tablesDir, file), "utf8");
        const problems: string[] = [];
        if (/\btimestamp\(/.test(source)) {
          problems.push(`${file}: timestamp(`);
        }
        if (/\.onUpdateNow\(/.test(source)) {
          problems.push(`${file}: .onUpdateNow(`);
        }
        return problems;
      });

    expect(offenders).toEqual([]);
  });

  it("keeps core MySQL column declarations inline in table files", () => {
    const tablesDir = join(process.cwd(), "src/schema/tables");
    const forbiddenHelperFiles = readdirSync(tablesDir).filter((file) =>
      /^_.*columns.*\.ts$/.test(file)
    );

    expect(forbiddenHelperFiles).toEqual([]);
  });

  it("keeps mysql2 and direct PlanetScale imports out of app code", () => {
    const directPlanetScaleSpecifier = "@planetscale/";
    const packageViolations: string[] = [];
    const sourceViolations: string[] = [];

    for (const filePath of workspaceFiles().filter((file) =>
      file.endsWith("package.json")
    )) {
      const packageJson = JSON.parse(readFileSync(filePath, "utf8")) as Record<
        string,
        Record<string, string> | undefined
      >;
      const relativePath = relative(WORKSPACE_ROOT, filePath);

      for (const section of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        const dependencies = packageJson[section] ?? {};

        if ("mysql2" in dependencies) {
          packageViolations.push(`${relativePath}: ${section}.mysql2`);
        }

        for (const dependencyName of Object.keys(dependencies)) {
          if (!dependencyName.startsWith(directPlanetScaleSpecifier)) {
            continue;
          }

          const allowedVendorDependency =
            relativePath === "vendor/db/package.json" &&
            section === "dependencies" &&
            dependencyName === "@planetscale/database";
          const allowedDrizzleKitPeer =
            relativePath === "db/app/package.json" &&
            section === "devDependencies" &&
            dependencyName === "@planetscale/database";

          if (!(allowedVendorDependency || allowedDrizzleKitPeer)) {
            packageViolations.push(
              `${relativePath}: ${section}.${dependencyName}`
            );
          }
        }
      }
    }

    for (const filePath of workspaceFiles().filter((file) =>
      SOURCE_FILE_PATTERN.test(file)
    )) {
      const relativePath = relative(WORKSPACE_ROOT, filePath);
      const source = readFileSync(filePath, "utf8");
      const hasDirectImport =
        source.includes(directPlanetScaleSpecifier) &&
        /(?:import\s+[^;]*?from\s*["']@planetscale\/|import\s*\(\s*["']@planetscale\/|export\s+[^;]*?from\s*["']@planetscale\/)/.test(
          source
        );

      if (hasDirectImport && !relativePath.startsWith("vendor/db/src/")) {
        sourceViolations.push(relativePath);
      }
    }

    expect([...packageViolations, ...sourceViolations]).toEqual([]);
  });
});
