# DB App PlanetScale Drizzle Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore `@db/app` to a clean, enforceable PlanetScale/Drizzle schema state with consistent naming, key, timestamp, migration, and rollout practices.

**Architecture:** Add guardrails first so current drift fails in tests, then move table names and schema file names to a scope-first taxonomy before standardizing inline column definitions. Because PlanetScale does not support direct table renames through deploy requests, live rollout uses an expand/backfill/contract path when data must be preserved; destructive drop/create is only allowed with explicit approval that the current live table data is disposable. After the live schema is aligned, retire the corrupted migration sequence and create a clean Drizzle baseline that future migrations can build on.

**Tech Stack:** pnpm monorepo, Drizzle ORM MySQL schema, PlanetScale/Vitess, `drizzle-orm/planetscale-serverless`, `@vendor/db`, Vitest, `pscale` CLI.

---

## Execution Notes

- Run commands from `/Users/jeevanpillay/.codex/worktrees/ed34/lightfast` unless a step explicitly changes directory.
- Load the `planetscale-drizzle`, `mysql`, and `vitess` skills before executing database tasks.
- Do not add `mysql2`.
- Do not import `@planetscale/database` directly in `@db/app`; keep runtime client construction behind `@vendor/db`.
- Do not hand-write committed Drizzle migration SQL. This plan allows deleting retired generated migration files and regenerating a new baseline with `pnpm db:generate`.
- Do not attempt direct table renames on PlanetScale. Treat existing-table naming changes as replacement-table rollout: add final table names, backfill, switch application reads/writes, then drop old names in a later contract step.
- Keep PlanetScale deploy requests small enough for PlanetScale limits. The live table-name contract phase must split table drops across multiple deploy requests when more than 10 tables change.
- Treat timestamps as UTC application instants stored as `datetime(3)`.
- Use Drizzle runtime `$onUpdate(() => new Date())` for `updated_at`; do not use DDL `.onUpdateNow()`.
- Keep column declarations inline in table files; do not add a schema helper file just to hide `bigint`, `datetime`, or timestamp defaults.
- Keep Vitess foreign-key posture: no `references()` and no SQL foreign keys.
- The one-time live repair must be rehearsed on a non-production PlanetScale branch before any deploy request is created.

## Current Audit Facts

- Branch baseline is `origin/main` at `17db02f7d`, which includes `34f24a70e fix(db): avoid planetscale on-update timestamp ddl`.
- `34f24a70e` replaced `.onUpdateNow()` with Drizzle runtime `$onUpdate(() => new Date())` in the affected schema sources and added `0020_blushing_living_tribunal.sql`.
- The existing `db/app/src/__tests__/migrations.test.ts` now passes locally with three tests: invalid timestamp precision `ON UPDATE`, primary-key rebuild statements, and schema-source `.onUpdateNow()`.
- Live `main` and `staging` both have 30 `lightfast_*` tables and no PlanetScale lint failures.
- Live `main` and `staging` have no branch diff from each other.
- The repo migration journal is still corrupt: 22 SQL files, 18 journal entries, four unjournaled SQL files, and journaled duplicate `CREATE TABLE` statements.
- Live `main` and `staging` still contain database-side `ON UPDATE current_timestamp(3)` clauses on:
  - `lightfast_org_source_control_bindings.updated_at`
  - `lightfast_source_control_repositories.updated_at`
  - `lightfast_source_control_webhook_deliveries.updated_at`
- Current repo schema sources still use `timestamp(3)` for many app-owned time columns; the cleanup target remains `datetime(3)` stored as UTC application instants.
- `lightfast_org_source_control_bindings.id` is signed `bigint`; related references use `bigint unsigned`.

## Target Conventions

- Table names: `mysqlTable("lightfast_<scope>_<domain>_<entity_plural>", ...)`.
- Scope prefixes:
  - `org_`: organization-owned product data. These tables must include `clerk_org_id` unless ownership is inherited from a same-scope parent row in the same file.
  - `user_`: user-owned private data. These tables must include `clerk_user_id` or another explicit user-owner column.
  - `system_`: platform/global operational data. These tables must not pretend to be org-owned; org/user references are optional context, not ownership.
- File names mirror scope and domain without the global table prefix: `org-signals.ts`, `user-source-control.ts`, `system-mcp-oauth.ts`.
- Drizzle table export names mirror the scoped table names without `lightfast_`, in camelCase: `orgSignals`, `userSourceControlAccounts`, `systemMcpOauthClients`.
- Domain model type names can stay unscoped where they already read naturally, such as `Signal`, `Person`, `Automation`, and `McpOauthClient`.
- Primary key: `id bigint unsigned primary key autoincrement`, Drizzle `{ mode: "number", unsigned: true }`.
- External ids: `public_id` or domain-specific public id columns, unique indexed, with app-generated prefixed ids.
- Timestamps: use `datetime(3)` for all app-owned time columns, with UTC values.
- `created_at`: `datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`.
- `updated_at`: `datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` plus Drizzle `$onUpdate(() => new Date())`.
- No `timestamp()` builders in app table schema.
- No `.onUpdateNow()` in app table schema.
- No SQL foreign keys. Use Drizzle `relations()` only for query ergonomics.
- Index names: omit `lightfast_`, start with the table scope (`org_`,
  `user_`, or `system_`), end in `_idx` or `_uq`, and stay within MySQL's
  64-character identifier limit.

## Approved Table Rename Map

| Ownership | Current table | Target table | Target file | Target export |
| --- | --- | --- | --- | --- |
| org | `lightfast_signals` | `lightfast_org_signals` | `org-signals.ts` | `orgSignals` |
| org | `lightfast_signal_views` | `lightfast_org_signal_views` | `org-signal-views.ts` | `orgSignalViews` |
| org | `lightfast_people` | `lightfast_org_people` | `org-people.ts` | `orgPeople` |
| org | `lightfast_people_views` | `lightfast_org_people_views` | `org-people-views.ts` | `orgPeopleViews` |
| org | `lightfast_automations` | `lightfast_org_automations` | `org-automations.ts` | `orgAutomations` |
| org | `lightfast_automation_runs` | `lightfast_org_automation_runs` | `org-automations.ts` | `orgAutomationRuns` |
| org | `lightfast_org_connector_connections` | `lightfast_org_connector_connections` | `org-connectors.ts` | `orgConnectorConnections` |
| org | `lightfast_provider_routine_calls` | `lightfast_org_provider_routine_calls` | `org-provider-routine-calls.ts` | `orgProviderRoutineCalls` |
| org | `lightfast_org_source_control_bindings` | `lightfast_org_source_control_bindings` | `org-source-control-bindings.ts` | `orgSourceControlBindings` |
| org | `lightfast_source_control_repositories` | `lightfast_org_source_control_repositories` | `org-source-control-repositories.ts` | `orgSourceControlRepositories` |
| org | `lightfast_source_control_webhook_deliveries` | `lightfast_org_source_control_webhook_deliveries` | `org-source-control-repositories.ts` | `orgSourceControlWebhookDeliveries` |
| org | `lightfast_identity_index_states` | `lightfast_org_identity_index_states` | `org-identity-index.ts` | `orgIdentityIndexStates` |
| org | `lightfast_identity_index_files` | `lightfast_org_identity_index_files` | `org-identity-index.ts` | `orgIdentityIndexFiles` |
| org | `lightfast_skill_index_states` | `lightfast_org_skill_index_states` | `org-skill-index.ts` | `orgSkillIndexStates` |
| org | `lightfast_skill_index_entries` | `lightfast_org_skill_index_entries` | `org-skill-index.ts` | `orgSkillIndexEntries` |
| org | `lightfast_workspace_assistant_conversations` | `lightfast_org_workspace_assistant_conversations` | `org-workspace-assistant.ts` | `orgWorkspaceAssistantConversations` |
| org | `lightfast_workspace_assistant_messages` | `lightfast_org_workspace_assistant_messages` | `org-workspace-assistant.ts` | `orgWorkspaceAssistantMessages` |
| org | `lightfast_workspace_assistant_generations` | `lightfast_org_workspace_assistant_generations` | `org-workspace-assistant.ts` | `orgWorkspaceAssistantGenerations` |
| org | `lightfast_workspace_assistant_tool_calls` | `lightfast_org_workspace_assistant_tool_calls` | `org-workspace-assistant.ts` | `orgWorkspaceAssistantToolCalls` |
| org | `lightfast_workspace_assistant_context_items` | `lightfast_org_workspace_assistant_context_items` | `org-workspace-assistant.ts` | `orgWorkspaceAssistantContextItems` |
| user | `lightfast_user_source_control_accounts` | `lightfast_user_source_control_accounts` | `user-source-control.ts` | `userSourceControlAccounts` |
| system | `lightfast_namespaces` | `lightfast_system_namespaces` | `system-namespaces.ts` | `systemNamespaces` |
| system | `lightfast_namespace_operations` | `lightfast_system_namespace_operations` | `system-namespaces.ts` | `systemNamespaceOperations` |
| system | `lightfast_mcp_oauth_clients` | `lightfast_system_mcp_oauth_clients` | `system-mcp-oauth.ts` | `systemMcpOauthClients` |
| system | `lightfast_mcp_oauth_client_redirect_uris` | `lightfast_system_mcp_oauth_client_redirect_uris` | `system-mcp-oauth.ts` | `systemMcpOauthClientRedirectUris` |
| system | `lightfast_mcp_oauth_registration_tokens` | `lightfast_system_mcp_oauth_registration_tokens` | `system-mcp-oauth.ts` | `systemMcpOauthRegistrationTokens` |
| system | `lightfast_mcp_oauth_authorization_codes` | `lightfast_system_mcp_oauth_authorization_codes` | `system-mcp-oauth.ts` | `systemMcpOauthAuthorizationCodes` |
| system | `lightfast_mcp_oauth_grants` | `lightfast_system_mcp_oauth_grants` | `system-mcp-oauth.ts` | `systemMcpOauthGrants` |
| system | `lightfast_mcp_oauth_refresh_tokens` | `lightfast_system_mcp_oauth_refresh_tokens` | `system-mcp-oauth.ts` | `systemMcpOauthRefreshTokens` |
| system | `lightfast_mcp_audit_events` | `lightfast_system_mcp_audit_events` | `system-mcp-oauth.ts` | `systemMcpAuditEvents` |

## File Map

- Create: `db/app/src/__tests__/schema-conventions.test.ts`
  - Enforces schema-wide conventions from the latest generated snapshot and source files.
- Modify: `db/app/src/__tests__/migrations.test.ts`
  - Adds migration journal integrity checks.
- Rename: `db/app/src/schema/tables/automations.ts` -> `db/app/src/schema/tables/org-automations.ts`
- Rename: `db/app/src/schema/tables/identity-index.ts` -> `db/app/src/schema/tables/org-identity-index.ts`
- Rename: `db/app/src/schema/tables/mcp-oauth.ts` -> `db/app/src/schema/tables/system-mcp-oauth.ts`
- Rename: `db/app/src/schema/tables/namespaces.ts` -> `db/app/src/schema/tables/system-namespaces.ts`
- Rename: `db/app/src/schema/tables/org-connector-connections.ts` -> `db/app/src/schema/tables/org-connectors.ts`
- Modify: `db/app/src/schema/tables/org-source-control-bindings.ts`
- Rename: `db/app/src/schema/tables/people-views.ts` -> `db/app/src/schema/tables/org-people-views.ts`
- Rename: `db/app/src/schema/tables/people.ts` -> `db/app/src/schema/tables/org-people.ts`
- Rename: `db/app/src/schema/tables/provider-routine-calls.ts` -> `db/app/src/schema/tables/org-provider-routine-calls.ts`
- Rename: `db/app/src/schema/tables/signal-views.ts` -> `db/app/src/schema/tables/org-signal-views.ts`
- Rename: `db/app/src/schema/tables/signals.ts` -> `db/app/src/schema/tables/org-signals.ts`
- Rename: `db/app/src/schema/tables/skill-index.ts` -> `db/app/src/schema/tables/org-skill-index.ts`
- Rename: `db/app/src/schema/tables/source-control-repositories.ts` -> `db/app/src/schema/tables/org-source-control-repositories.ts`
- Rename: `db/app/src/schema/tables/user-source-control-accounts.ts` -> `db/app/src/schema/tables/user-source-control.ts`
- Rename: `db/app/src/schema/tables/workspace-assistant.ts` -> `db/app/src/schema/tables/org-workspace-assistant.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/relations.ts`
- Modify: repo callers importing old table exports or old table file paths.
- Modify: `db/app/README.md`
- Modify: `db/CLAUDE.md`
- Regenerate: `db/app/src/migrations/**`

---

### Task 1: Add Migration And Schema Guardrails

**Files:**
- Modify: `db/app/src/__tests__/migrations.test.ts`
- Create: `db/app/src/__tests__/schema-conventions.test.ts`

- [ ] **Step 1: Add missing migration guardrails**

Keep the three migration tests added by `34f24a70e`. Append these tests inside the existing `describe("migration SQL", ...)` block in `db/app/src/__tests__/migrations.test.ts`:

```ts
  it("keeps the SQL files and journal entries in one-to-one alignment", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const journalPath = join(migrationsDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    const sqlFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const journalSqlFiles = journal.entries
      .map((entry) => `${entry.tag}.sql`)
      .sort();
    const journalIndexes = journal.entries.map((entry) => entry.idx);

    expect(sqlFiles).toEqual(journalSqlFiles);
    expect(journalIndexes).toEqual(journal.entries.map((_, index) => index));
  });

  it("does not create the same table twice in journaled migrations", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const journalPath = join(migrationsDir, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: Array<{ tag: string }>;
    };
    const firstCreateByTable = new Map<string, string>();
    const duplicateCreates: string[] = [];

    for (const entry of journal.entries) {
      const sql = readFileSync(join(migrationsDir, `${entry.tag}.sql`), "utf8");
      for (const match of sql.matchAll(/CREATE TABLE `([^`]+)`/g)) {
        const tableName = match[1]!;
        const firstCreate = firstCreateByTable.get(tableName);
        if (firstCreate) {
          duplicateCreates.push(`${tableName}: ${firstCreate}, ${entry.tag}`);
        } else {
          firstCreateByTable.set(tableName, entry.tag);
        }
      }
    }

    expect(duplicateCreates).toEqual([]);
  });

  it("does not emit database-side timestamp on-update clauses", () => {
    const migrationsDir = join(process.cwd(), "src/migrations");
    const offenders = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = readFileSync(join(migrationsDir, file), "utf8");
        const invalid = sql.match(/\bON UPDATE\s+CURRENT_TIMESTAMP(?:\(\d+\))?/gi);

        return invalid ? [file] : [];
      });

    expect(offenders).toEqual([]);
  });
```

- [ ] **Step 2: Add schema convention tests**

Create `db/app/src/__tests__/schema-conventions.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface DrizzleJournal {
  entries: Array<{ idx: number; tag: string }>;
}

interface DrizzleSnapshot {
  tables: Record<
    string,
    {
      columns: Record<string, { type: string }>;
      foreignKeys: Record<string, unknown>;
      compositePrimaryKeys: Record<string, { columns: string[] }>;
      indexes: Record<string, { isUnique: boolean }>;
    }
  >;
}

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

describe("schema conventions", () => {
  it("uses scope-first app table names with unsigned bigint id primary keys", () => {
    const snapshot = latestSnapshot();
    const tableNamePattern = /^lightfast_(org|user|system)_[a-z0-9]+(?:_[a-z0-9]+)*$/;
    const violations: string[] = [];

    for (const [tableName, table] of Object.entries(snapshot.tables)) {
      const primaryKeyColumns = Object.values(table.compositePrimaryKeys)
        .flatMap((primaryKey) => primaryKey.columns);

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

  it("uses datetime(3) for every app-owned time column", () => {
    const snapshot = latestSnapshot();
    const violations: string[] = [];

    for (const [tableName, table] of Object.entries(snapshot.tables)) {
      for (const [columnName, column] of Object.entries(table.columns)) {
        if (/(?:_at|_until)$/.test(columnName) && column.type !== "datetime(3)") {
          violations.push(`${tableName}.${columnName}: ${column.type}`);
        }
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
    const forbiddenHelperFiles = readdirSync(tablesDir)
      .filter((file) => /^_.*columns.*\.ts$/.test(file));

    expect(forbiddenHelperFiles).toEqual([]);
  });
});
```

- [ ] **Step 3: Run guardrails and verify current failures**

Run:

```bash
pnpm --filter @db/app test src/__tests__/migrations.test.ts src/__tests__/schema-conventions.test.ts
```

Expected: FAIL. The failure must mention the current journal mismatch, duplicate `CREATE TABLE`s, old database-side `ON UPDATE` migration SQL, missing `lightfast_<scope>_` table prefixes, non-scope schema file names, timestamp builders, non-`datetime(3)` time columns, and the signed `lightfast_org_source_control_bindings.id`.

- [ ] **Step 4: Commit the failing guardrails**

```bash
git add db/app/src/__tests__/migrations.test.ts db/app/src/__tests__/schema-conventions.test.ts
git commit -m "test(db): add PlanetScale schema cleanup guardrails"
```

---

### Task 2: Apply Scope-First Table And File Naming

**Files:**
- Rename table source files listed in the File Map.
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/relations.ts`
- Modify: repo callers importing old table exports.
- Test: `db/app/src/__tests__/schema-conventions.test.ts`

- [ ] **Step 1: Rename schema table files**

Run:

```bash
git mv db/app/src/schema/tables/automations.ts db/app/src/schema/tables/org-automations.ts
git mv db/app/src/schema/tables/identity-index.ts db/app/src/schema/tables/org-identity-index.ts
git mv db/app/src/schema/tables/mcp-oauth.ts db/app/src/schema/tables/system-mcp-oauth.ts
git mv db/app/src/schema/tables/namespaces.ts db/app/src/schema/tables/system-namespaces.ts
git mv db/app/src/schema/tables/org-connector-connections.ts db/app/src/schema/tables/org-connectors.ts
git mv db/app/src/schema/tables/people-views.ts db/app/src/schema/tables/org-people-views.ts
git mv db/app/src/schema/tables/people.ts db/app/src/schema/tables/org-people.ts
git mv db/app/src/schema/tables/provider-routine-calls.ts db/app/src/schema/tables/org-provider-routine-calls.ts
git mv db/app/src/schema/tables/signal-views.ts db/app/src/schema/tables/org-signal-views.ts
git mv db/app/src/schema/tables/signals.ts db/app/src/schema/tables/org-signals.ts
git mv db/app/src/schema/tables/skill-index.ts db/app/src/schema/tables/org-skill-index.ts
git mv db/app/src/schema/tables/source-control-repositories.ts db/app/src/schema/tables/org-source-control-repositories.ts
git mv db/app/src/schema/tables/user-source-control-accounts.ts db/app/src/schema/tables/user-source-control.ts
git mv db/app/src/schema/tables/workspace-assistant.ts db/app/src/schema/tables/org-workspace-assistant.ts
```

Expected: `git status --short db/app/src/schema/tables` shows renames for the listed files and leaves `index.ts` plus `org-source-control-bindings.ts` in place.

- [ ] **Step 2: Rename Drizzle table exports and table names**

Apply this exact table export and SQL table-name mapping:

```text
signals -> orgSignals: lightfast_signals -> lightfast_org_signals
signalViews -> orgSignalViews: lightfast_signal_views -> lightfast_org_signal_views
people -> orgPeople: lightfast_people -> lightfast_org_people
peopleViews -> orgPeopleViews: lightfast_people_views -> lightfast_org_people_views
automations -> orgAutomations: lightfast_automations -> lightfast_org_automations
automationRuns -> orgAutomationRuns: lightfast_automation_runs -> lightfast_org_automation_runs
orgConnectorConnections -> orgConnectorConnections: lightfast_org_connector_connections -> lightfast_org_connector_connections
providerRoutineCalls -> orgProviderRoutineCalls: lightfast_provider_routine_calls -> lightfast_org_provider_routine_calls
orgSourceControlBindings -> orgSourceControlBindings: lightfast_org_source_control_bindings -> lightfast_org_source_control_bindings
sourceControlRepositories -> orgSourceControlRepositories: lightfast_source_control_repositories -> lightfast_org_source_control_repositories
sourceControlWebhookDeliveries -> orgSourceControlWebhookDeliveries: lightfast_source_control_webhook_deliveries -> lightfast_org_source_control_webhook_deliveries
identityIndexStates -> orgIdentityIndexStates: lightfast_identity_index_states -> lightfast_org_identity_index_states
identityIndexFiles -> orgIdentityIndexFiles: lightfast_identity_index_files -> lightfast_org_identity_index_files
skillIndexStates -> orgSkillIndexStates: lightfast_skill_index_states -> lightfast_org_skill_index_states
skillIndexEntries -> orgSkillIndexEntries: lightfast_skill_index_entries -> lightfast_org_skill_index_entries
workspaceAssistantConversations -> orgWorkspaceAssistantConversations: lightfast_workspace_assistant_conversations -> lightfast_org_workspace_assistant_conversations
workspaceAssistantMessages -> orgWorkspaceAssistantMessages: lightfast_workspace_assistant_messages -> lightfast_org_workspace_assistant_messages
workspaceAssistantGenerations -> orgWorkspaceAssistantGenerations: lightfast_workspace_assistant_generations -> lightfast_org_workspace_assistant_generations
workspaceAssistantToolCalls -> orgWorkspaceAssistantToolCalls: lightfast_workspace_assistant_tool_calls -> lightfast_org_workspace_assistant_tool_calls
workspaceAssistantContextItems -> orgWorkspaceAssistantContextItems: lightfast_workspace_assistant_context_items -> lightfast_org_workspace_assistant_context_items
userSourceControlAccounts -> userSourceControlAccounts: lightfast_user_source_control_accounts -> lightfast_user_source_control_accounts
namespaces -> systemNamespaces: lightfast_namespaces -> lightfast_system_namespaces
namespaceOperations -> systemNamespaceOperations: lightfast_namespace_operations -> lightfast_system_namespace_operations
mcpOauthClients -> systemMcpOauthClients: lightfast_mcp_oauth_clients -> lightfast_system_mcp_oauth_clients
mcpOauthClientRedirectUris -> systemMcpOauthClientRedirectUris: lightfast_mcp_oauth_client_redirect_uris -> lightfast_system_mcp_oauth_client_redirect_uris
mcpOauthRegistrationTokens -> systemMcpOauthRegistrationTokens: lightfast_mcp_oauth_registration_tokens -> lightfast_system_mcp_oauth_registration_tokens
mcpOauthAuthorizationCodes -> systemMcpOauthAuthorizationCodes: lightfast_mcp_oauth_authorization_codes -> lightfast_system_mcp_oauth_authorization_codes
mcpOauthGrants -> systemMcpOauthGrants: lightfast_mcp_oauth_grants -> lightfast_system_mcp_oauth_grants
mcpOauthRefreshTokens -> systemMcpOauthRefreshTokens: lightfast_mcp_oauth_refresh_tokens -> lightfast_system_mcp_oauth_refresh_tokens
mcpAuditEvents -> systemMcpAuditEvents: lightfast_mcp_audit_events -> lightfast_system_mcp_audit_events
```

Keep domain model type names such as `Signal`, `Person`, `Automation`, `McpOauthClient`, and insert types unchanged in this task.

- [ ] **Step 3: Update barrel exports, relations, and repo callers**

Update `db/app/src/schema/tables/index.ts` to export from the new file names and the new table export names. Update `db/app/src/schema/relations.ts` and every import/caller that still references an old table export.

Run these scans until they return no matches:

```bash
rg -n 'from "\./(automations|identity-index|mcp-oauth|namespaces|org-connector-connections|people-views|people|provider-routine-calls|signal-views|signals|skill-index|source-control-repositories|user-source-control-accounts|workspace-assistant)"' db/app/src/schema/tables db/app/src/schema/relations.ts
rg -n '\b(automations|automationRuns|identityIndexStates|identityIndexFiles|mcpAuditEvents|mcpOauthAuthorizationCodes|mcpOauthClientRedirectUris|mcpOauthClients|mcpOauthGrants|mcpOauthRefreshTokens|mcpOauthRegistrationTokens|namespaceOperations|namespaces|people|peopleViews|providerRoutineCalls|signalViews|signals|skillIndexEntries|skillIndexStates|sourceControlRepositories|sourceControlWebhookDeliveries|workspaceAssistantContextItems|workspaceAssistantConversations|workspaceAssistantGenerations|workspaceAssistantMessages|workspaceAssistantToolCalls)\b' db/app/src/schema db/app/src/__tests__ --glob '*.ts'
rg -n '"lightfast_(signals|signal_views|people|people_views|automations|automation_runs|provider_routine_calls|source_control_repositories|source_control_webhook_deliveries|identity_index_states|identity_index_files|skill_index_states|skill_index_entries|workspace_assistant_|namespaces|namespace_operations|mcp_oauth_|mcp_audit_events)' db/app/src/schema/tables
```

Expected: all old table export names and old table string literals are gone from schema files. Downstream caller cleanup is verified by TypeScript in Step 4.

- [ ] **Step 4: Run focused validation**

Run:

```bash
pnpm --filter @db/app typecheck
pnpm --filter @db/app test src/__tests__/schema-conventions.test.ts
```

Expected:
- Typecheck passes after all imports and relations are updated.
- `schema-conventions.test.ts` still fails on migration snapshot table names until the clean baseline is generated in Task 5.
- The schema source file-name convention check passes.

- [ ] **Step 5: Commit naming standardization**

```bash
git add db/app/src/schema db/app/src/__tests__/schema-conventions.test.ts
git commit -m "refactor(db): adopt scope-first app schema names"
```

---

### Task 3: Standardize Table Schemas

**Files:**
- Modify every table file listed in the File Map.
- Test: `db/app/src/__tests__/schema-conventions.test.ts`

- [ ] **Step 1: Update imports in table files**

For each table file, remove `timestamp` from `drizzle-orm/mysql-core` imports. Keep `datetime` and `bigint` imported directly from `drizzle-orm/mysql-core`.

Ensure `sql` is imported from `drizzle-orm` anywhere the file uses `CURRENT_TIMESTAMP(3)` defaults:

```ts
import { sql } from "drizzle-orm";
import { bigint, datetime } from "drizzle-orm/mysql-core";
```

- [ ] **Step 2: Convert primary keys**

Replace every normal app table id declaration with:

```ts
id: bigint("id", { mode: "number", unsigned: true })
  .primaryKey()
  .autoincrement(),
```

This fixes `orgSourceControlBindings.id`, which currently lacks `unsigned: true`, and keeps all other ids unchanged semantically.

- [ ] **Step 3: Convert standard timestamps**

Replace every `createdAt` declaration with:

```ts
createdAt: datetime("created_at", { mode: "date", fsp: 3 })
  .default(sql`CURRENT_TIMESTAMP(3)`)
  .notNull(),
```

Replace every `updatedAt` declaration with:

```ts
updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
  .default(sql`CURRENT_TIMESTAMP(3)`)
  .$onUpdate(() => new Date())
  .notNull(),
```

This keeps the runtime update behavior introduced by `34f24a70e` and removes every `timestamp("updated_at", ...)` builder from app schema sources.

- [ ] **Step 4: Convert non-standard time columns**

Use inline `datetime("<column_name>", { mode: "date", fsp: 3 })` for every other app-owned time column.

Required not-null examples:

```ts
connectedAt: datetime("connected_at", { mode: "date", fsp: 3 })
  .default(sql`CURRENT_TIMESTAMP(3)`)
  .notNull(),

dueAt: datetime("due_at", { mode: "date", fsp: 3 }).notNull(),

startedAt: datetime("started_at", { mode: "date", fsp: 3 }).notNull(),

accessTokenExpiresAt: datetime("access_token_expires_at", {
  mode: "date",
  fsp: 3,
}).notNull(),

refreshTokenExpiresAt: datetime("refresh_token_expires_at", {
  mode: "date",
  fsp: 3,
}).notNull(),

expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
```

Required nullable examples:

```ts
revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),

nextRunAt: datetime("next_run_at", { mode: "date", fsp: 3 }),

lastRunAt: datetime("last_run_at", { mode: "date", fsp: 3 }),

finishedAt: datetime("finished_at", { mode: "date", fsp: 3 }),

indexedAt: datetime("indexed_at", { mode: "date", fsp: 3 }),

lastCheckedAt: datetime("last_checked_at", { mode: "date", fsp: 3 }),

refreshLockedUntil: datetime("refresh_locked_until", {
  mode: "date",
  fsp: 3,
}),

lastMessageAt: datetime("last_message_at", { mode: "date", fsp: 3 }),
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @db/app test src/__tests__/schema-conventions.test.ts
pnpm --filter @db/app typecheck
```

Expected: `schema-conventions.test.ts` still fails until migrations are regenerated, but no TypeScript errors remain.

- [ ] **Step 6: Commit schema source standardization**

```bash
git add db/app/src/schema/tables
git commit -m "refactor(db): standardize app table column conventions"
```

---

### Task 4: Rehearse The Schema Repair And Naming Rollout On PlanetScale

**Files:**
- No repo files modified.

- [ ] **Step 1: Confirm PlanetScale auth and branches**

Run:

```bash
pscale auth check
pscale branch list lightfast --format json
pscale branch lint lightfast main --format json
pscale branch lint lightfast staging --format json
```

Expected:
- `pscale auth check` prints `You are authenticated.`
- `main` and `staging` exist.
- Both lint commands return `[]`.

- [ ] **Step 2: Create a rehearsal branch**

Run:

```bash
pscale branch create lightfast schema-cleanup-rehearsal-20260603 --from main --wait
pscale password create lightfast schema-cleanup-rehearsal-20260603 schema-cleanup-rehearsal-20260603 --format json > /tmp/lightfast-schema-cleanup-rehearsal-password.json
```

Expected: branch creation completes, and the password JSON file contains host, username, and password fields for the rehearsal branch.

- [ ] **Step 3: Apply the final TypeScript schema to the disposable rehearsal branch**

Export the password fields from `/tmp/lightfast-schema-cleanup-rehearsal-password.json` and run the push from `db/app`:

```bash
cd db/app
DATABASE_HOST="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-rehearsal-password.json"); console.log(p.database_branch.access_host_url ?? p.host ?? p.hostname)')" \
DATABASE_USERNAME="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-rehearsal-password.json"); console.log(p.username)')" \
DATABASE_PASSWORD="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-rehearsal-password.json"); console.log(p.plain_text ?? p.password)')" \
pnpm exec drizzle-kit push --config=./src/drizzle.config.ts
```

Expected: Drizzle reports the final-state schema diff and applies it to the rehearsal branch. Because the target table names changed, this rehearsal branch is allowed to show destructive old-table drops. This diff is evidence for planning; it must not be deployed to `main` when live data must be preserved.

The final-state diff must contain:
- Creates for the scope-first target tables in the Approved Table Rename Map.
- Drops for the old unscoped table names in the Approved Table Rename Map.
- `timestamp(3)` or old live `datetime(3)` time columns converging to `datetime(3)`.
- `lightfast_org_source_control_bindings.id` converging to `bigint unsigned`.
- Removal of the remaining database-side `ON UPDATE` clauses on `lightfast_org_source_control_bindings`, `lightfast_source_control_repositories`, and `lightfast_source_control_webhook_deliveries`.

- [ ] **Step 4: Lint and inspect the rehearsal diff**

Run:

```bash
cd /Users/jeevanpillay/.codex/worktrees/ed34/lightfast
pscale branch lint lightfast schema-cleanup-rehearsal-20260603 --format json
pscale branch diff lightfast schema-cleanup-rehearsal-20260603 --format json > /tmp/lightfast-schema-cleanup-rehearsal-diff.json
node -e 'const diff=require("/tmp/lightfast-schema-cleanup-rehearsal-diff.json"); console.log(JSON.stringify(diff, null, 2))'
```

Expected:
- Lint returns `[]`.
- The branch diff may show old table drops because this is a direct final-state rehearsal.
- The branch diff has no foreign-key additions.
- The branch diff has no `DROP PRIMARY KEY`.
- The branch diff contains all final scope-first table names from the Approved Table Rename Map.
- If the diff would change more than 10 tables in one deploy request, record that the live rollout must be split into multiple deploy-request waves.

- [ ] **Step 5: Commit rehearsal evidence**

No command output is committed. Add a short note to the PR body during execution with the lint and diff summary.

---

### Task 5: Retire Corrupt Generated Migrations And Create A Clean Baseline

**Files:**
- Regenerate: `db/app/src/migrations/**`
- Test: `db/app/src/__tests__/migrations.test.ts`
- Test: `db/app/src/__tests__/schema-conventions.test.ts`

- [ ] **Step 1: Remove the corrupt migration sequence**

Run:

```bash
git rm db/app/src/migrations/*.sql
git rm db/app/src/migrations/meta/*.json
```

Expected: all old generated SQL files, snapshots, and `_journal.json` are staged for removal.

This intentionally removes `0020_blushing_living_tribunal.sql` as part of the corrupt generated sequence. Its runtime behavior is retained in source through `$onUpdate(() => new Date())`, and the new clean baseline will contain the final `datetime(3)` schema without database-side `ON UPDATE` clauses.

- [ ] **Step 2: Generate a clean baseline from the standardized schema**

Run:

```bash
cd db/app
SKIP_ENV_VALIDATION=1 pnpm db:generate
```

Expected: Drizzle creates a new `src/migrations/0000_*.sql`, `src/migrations/meta/0000_snapshot.json`, and `src/migrations/meta/_journal.json`.

- [ ] **Step 3: Verify migration and schema guardrails pass**

Run:

```bash
pnpm --filter @db/app test src/__tests__/migrations.test.ts src/__tests__/schema-conventions.test.ts
pnpm --filter @db/app exec drizzle-kit check --config=./src/drizzle.config.ts
```

Expected:
- Both test files pass.
- `drizzle-kit check` prints `Everything's fine`.

- [ ] **Step 4: Commit the clean baseline**

```bash
git add db/app/src/migrations db/app/src/__tests__/migrations.test.ts db/app/src/__tests__/schema-conventions.test.ts
git commit -m "chore(db): reset app schema migration baseline"
```

---

### Task 6: Deploy The Schema Repair And Seed Staging Baseline

**Files:**
- No schema source files modified in this task.

- [ ] **Step 1: Confirm the live table data policy**

Run:

```bash
pscale branch schema lightfast main --format json > /tmp/lightfast-main-schema-before-cleanup.json
pscale branch schema lightfast staging --format json > /tmp/lightfast-staging-schema-before-cleanup.json
```

Expected:
- If live `main` and `staging` table data must be preserved, stop before applying the final schema directly. Use the data-preserving rollout below: add final tables in deploy-request waves, backfill from old tables to new tables, deploy app reads/writes to final table exports, then contract old tables in later deploy-request waves.
- If the user explicitly confirms that the current live table data is disposable, continue to Step 2 and apply the final schema directly to staging.

Data-preserving rollout waves:

```text
Expand wave 1: org_signals, org_signal_views, org_people, org_people_views, org_automations, org_automation_runs, org_connector_connections, org_provider_routine_calls, org_source_control_bindings, org_source_control_repositories
Expand wave 2: org_source_control_webhook_deliveries, org_identity_index_states, org_identity_index_files, org_skill_index_states, org_skill_index_entries, org_workspace_assistant_conversations, org_workspace_assistant_messages, org_workspace_assistant_generations, org_workspace_assistant_tool_calls, org_workspace_assistant_context_items
Expand wave 3: user_source_control_accounts, system_namespaces, system_namespace_operations, system_mcp_oauth_clients, system_mcp_oauth_client_redirect_uris, system_mcp_oauth_registration_tokens, system_mcp_oauth_authorization_codes, system_mcp_oauth_grants, system_mcp_oauth_refresh_tokens, system_mcp_audit_events
Contract wave 1: old signal, people, automation, connector, provider routine, and source-control table names
Contract wave 2: old identity index, skill index, and workspace assistant table names
Contract wave 3: old namespace and MCP OAuth table names
```

- [ ] **Step 2: Apply the final schema directly to staging only when live data is disposable**

Create a short-lived staging repair password and apply the schema with `db:push`:

```bash
pscale password create lightfast staging schema-cleanup-staging-20260603 --format json > /tmp/lightfast-schema-cleanup-staging-password.json
cd db/app
DATABASE_HOST="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-staging-password.json"); console.log(p.database_branch.access_host_url ?? p.host ?? p.hostname)')" \
DATABASE_USERNAME="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-staging-password.json"); console.log(p.username)')" \
DATABASE_PASSWORD="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-staging-password.json"); console.log(p.plain_text ?? p.password)')" \
pnpm exec drizzle-kit push --config=./src/drizzle.config.ts
```

Expected: staging receives the same schema changes rehearsed in Task 4.

- [ ] **Step 3: Lint and diff staging**

Run:

```bash
cd /Users/jeevanpillay/.codex/worktrees/ed34/lightfast
pscale branch lint lightfast staging --format json
pscale branch diff lightfast staging --format json
```

Expected:
- Lint returns `[]`.
- Diff shows only the approved cleanup schema changes from Task 4.

- [ ] **Step 4: Open and deploy the PlanetScale deploy request**

Run:

```bash
pscale deploy-request create lightfast staging --into main --notes "Align @db/app schema conventions: scope-first table names, datetime(3) UTC columns, unsigned ids, no DB-side updated_at on-update clauses, and clean Drizzle baseline."
```

Expected: PlanetScale creates a deploy request from `staging` into `main`. Review the deploy request in the PlanetScale UI, confirm the schema diff matches Task 4, and deploy only after human approval. Do not deploy if old table drops are present and live table data is not disposable.

- [ ] **Step 5: Seed the staging Drizzle journal through the new baseline**

Find the generated baseline tag:

```bash
node -e 'const j=require("./db/app/src/migrations/meta/_journal.json"); console.log(j.entries.at(-1).tag)'
```

Assume the printed value is stored in `BASELINE_TAG`, then run:

```bash
cd db/app
BASELINE_TAG="$(node -e 'const j=require("./src/migrations/meta/_journal.json"); console.log(j.entries.at(-1).tag)')" \
DATABASE_HOST="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-staging-password.json"); console.log(p.database_branch.access_host_url ?? p.host ?? p.hostname)')" \
DATABASE_USERNAME="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-staging-password.json"); console.log(p.username)')" \
DATABASE_PASSWORD="$(node -e 'const p=require("/tmp/lightfast-schema-cleanup-staging-password.json"); console.log(p.plain_text ?? p.password)')" \
pnpm db:baseline -- --through="$BASELINE_TAG"
```

Expected: staging `__drizzle_migrations` is seeded through the clean baseline. Future `pnpm db:migrate` runs against staging will skip the baseline and apply only later generated migrations.

---

### Task 7: Document The New Database Rules

**Files:**
- Modify: `db/app/README.md`
- Modify: `db/CLAUDE.md`

- [ ] **Step 1: Update `db/app/README.md`**

Add this section after the Driver section:

```md
## Schema Conventions

- App table names use `lightfast_<scope>_<domain>_<entity_plural>`.
- Valid table scopes are `org`, `user`, and `system`.
- Schema file names mirror scope and domain without the global `lightfast_` prefix, such as `org-signals.ts`, `user-source-control.ts`, and `system-mcp-oauth.ts`.
- Drizzle table export names mirror the scoped table name without `lightfast_`, in camelCase, such as `orgSignals`, `userSourceControlAccounts`, and `systemMcpOauthClients`.
- App tables use an internal `id bigint unsigned primary key autoincrement`.
- Public/external identifiers use app-generated prefixed string columns such as `public_id`.
- App-owned time columns store UTC instants as `datetime(3)`.
- `created_at` defaults to `CURRENT_TIMESTAMP(3)`.
- `updated_at` defaults to `CURRENT_TIMESTAMP(3)` and is maintained by Drizzle `$onUpdate(() => new Date())`.
- Generated SQL must not contain database-side `ON UPDATE CURRENT_TIMESTAMP` clauses.
- Do not use `timestamp()` or `.onUpdateNow()` in app table schema files.
- Do not add SQL foreign keys; use Drizzle `relations()` for query ergonomics and enforce referential integrity in application code.
- Generate migrations with `pnpm db:generate`; do not hand-write migration SQL.
```

- [ ] **Step 2: Update `db/CLAUDE.md`**

Add the same convention bullets under `## Migration Rules`, before the existing list.

- [ ] **Step 3: Commit documentation**

```bash
git add db/app/README.md db/CLAUDE.md
git commit -m "docs(db): document PlanetScale schema conventions"
```

---

### Task 8: Full Verification

**Files:**
- No new source files expected.

- [ ] **Step 1: Run package checks**

Run:

```bash
pnpm --filter @db/app test
pnpm --filter @db/app typecheck
cd db/app && SKIP_ENV_VALIDATION=1 pnpm exec drizzle-kit check --config=./src/drizzle.config.ts
```

Expected:
- All `@db/app` tests pass.
- TypeScript emits no errors.
- Drizzle check prints `Everything's fine`.

- [ ] **Step 2: Run PlanetScale branch checks**

Run:

```bash
pscale branch lint lightfast main --format json
pscale branch lint lightfast staging --format json
pscale branch diff lightfast staging --format json
pscale branch schema lightfast main --format json > /tmp/lightfast-main-schema-after-cleanup.json
pscale branch schema lightfast staging --format json > /tmp/lightfast-staging-schema-after-cleanup.json
```

Expected:
- Both lint commands return `[]`.
- Staging has no diff from main after deployment.
- The main and staging schema files both contain 30 scope-first `lightfast_(org|user|system)_*` tables.
- No app table raw schema contains `timestamp(3)`.
- No app table raw schema contains `FOREIGN KEY`.
- No app table raw schema contains `ON UPDATE`.

- [ ] **Step 3: Run workspace-level checks**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: both commands pass.

- [ ] **Step 4: Final commit**

```bash
git status --short
git add db/app db/CLAUDE.md
git commit -m "chore(db): align app schema with PlanetScale best practices"
```

Expected: the commit contains only `@db/app` schema/tests/migration baseline changes and database docs.

---

## Self-Review

- Spec coverage: covers migration corruption, live schema drift, scope-first table and file naming, timestamp policy, unsigned ids, no foreign keys, PlanetScale lint, data-preserving rename rollout, and future guardrails.
- Placeholder scan: no deferred task and no unspecified migration repair mechanism.
- Type consistency: inline Drizzle patterns are consistent across tasks: `bigint("id", { mode: "number", unsigned: true })`, `datetime(name, { mode: "date", fsp: 3 })`, `CURRENT_TIMESTAMP(3)`, and `$onUpdate(() => new Date())`.
- Risk: the live repair uses `db:push` and a PlanetScale deploy request because the existing generated migration history is unsafe to replay. That is intentional and isolated to this cleanup.
