import type { NativeSession } from "@repo/native-auth-contract";
import type { Command } from "commander";
import { getAppUrl } from "../auth/config";
import { CliAuthError } from "../auth/errors";
import type { SessionStoreLike } from "../auth/session";
import { callProxyRoutine, findProxyRoutines } from "./client";

interface RegisterProxyCommandsDeps {
  appUrl?: string;
  fetchImpl?: typeof fetch;
  stdout?: NodeJS.WritableStream;
  store: SessionStoreLike;
}

interface FindOptions {
  includeSchema?: boolean;
  limit?: string;
  provider?: string;
  readOnly?: boolean;
  routineId?: string;
}

interface CallOptions {
  json: string;
}

function writeJson(stream: NodeJS.WritableStream | undefined, value: unknown) {
  (stream ?? process.stdout).write(`${JSON.stringify(value, null, 2)}\n`);
}

async function requireSession(store: SessionStoreLike): Promise<NativeSession> {
  const session = await store.get();
  if (!session) {
    throw new CliAuthError(
      "NOT_LOGGED_IN",
      "Not signed in. Run `lightfast login`."
    );
  }
  return session;
}

function parseLimit(value: string | undefined): number | undefined {
  if (!value) {
    return;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliAuthError(
      "INVALID_LIMIT",
      "--limit must be a positive integer."
    );
  }
  return parsed;
}

function parseJsonObject(value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new CliAuthError("INVALID_JSON", "--json must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliAuthError("INVALID_JSON", "--json must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

export function registerProxyCommands(
  program: Command,
  deps: RegisterProxyCommandsDeps
) {
  const proxy = program
    .command("proxy")
    .description("Find and call connected provider routines");

  proxy
    .command("find")
    .description("Find connected provider routines")
    .argument("[query...]", "Search terms")
    .option("--provider <provider>", "Provider filter")
    .option("--routine-id <routineId>", "Provider routine id filter")
    .option("--include-schema", "Include input schemas in results")
    .option("--read-only", "Only return read-only routines")
    .option("--limit <limit>", "Maximum routines to return")
    .action(async (queryParts: string[], options: FindOptions) => {
      const session = await requireSession(deps.store);
      const result = await findProxyRoutines({
        appUrl: deps.appUrl ?? getAppUrl(),
        fetchImpl: deps.fetchImpl,
        includeSchema: options.includeSchema === true,
        limit: parseLimit(options.limit),
        provider: options.provider,
        query: queryParts.length > 0 ? queryParts.join(" ") : undefined,
        readOnly: options.readOnly === true,
        routineId: options.routineId,
        session,
      });
      writeJson(deps.stdout, result);
    });

  proxy
    .command("call")
    .description("Call a connected provider routine")
    .argument("<routineId>", "Provider routine id, e.g. linear__create_issue")
    .requiredOption("--json <json>", "JSON object input")
    .action(async (routineId: string, options: CallOptions) => {
      const input = parseJsonObject(options.json);
      const session = await requireSession(deps.store);
      const result = await callProxyRoutine({
        appUrl: deps.appUrl ?? getAppUrl(),
        fetchImpl: deps.fetchImpl,
        payload: { input, routineId },
        session,
      });
      writeJson(deps.stdout, result);
    });
}
