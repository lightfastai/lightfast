import type { Database, ProviderRoutineCall } from "@db/app";
import { orgProviderRoutineCalls as decisionSources } from "@db/app/schema";
import {
  type DecisionDetail,
  type DecisionFindInput,
  type DecisionFindOutput,
  type DecisionSummary,
  decisionFindInputSchema,
} from "@repo/api-contract";
import { and, desc, eq, gte, inArray, lt, lte, or, sql } from "drizzle-orm";
import { classifyRoutine } from "../provider-routines/policy";

const DEFAULT_FIND_LIMIT = 50;
const MAX_QUERY_TERMS = 10;

export type DecisionRecord = ProviderRoutineCall & {
  classification: DecisionSummary["classification"];
  decisionId: string;
  snippet: string;
  title: string;
};

export interface FindDecisionRecordsResult {
  items: DecisionRecord[];
  nextCursor: DecisionFindOutput["nextCursor"];
}

export async function findDecisionRecords(
  db: Database,
  input: { clerkOrgId: string } & DecisionFindInput
): Promise<FindDecisionRecordsResult> {
  const { clerkOrgId, ...rawInput } = input;
  const parsed = decisionFindInputSchema.parse(rawInput);
  const limit = parsed.limit ?? DEFAULT_FIND_LIMIT;
  const conditions = decisionWhereConditions(clerkOrgId, parsed);

  const rows = await db
    .select()
    .from(decisionSources)
    .where(and(...conditions))
    .orderBy(desc(decisionSources.createdAt), desc(decisionSources.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map(toDecisionRecord);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && lastItem
        ? { createdAt: lastItem.createdAt, id: lastItem.id }
        : null,
  };
}

export async function findDecisions(
  db: Database,
  input: { clerkOrgId: string } & DecisionFindInput
): Promise<DecisionFindOutput> {
  const records = await findDecisionRecords(db, input);
  return {
    items: records.items.map(toDecisionSummary),
    nextCursor: records.nextCursor,
  };
}

export async function getDecision(
  db: Database,
  input: { clerkOrgId: string; id: string }
): Promise<DecisionDetail | undefined> {
  const [row] = await db
    .select()
    .from(decisionSources)
    .where(
      and(
        eq(decisionSources.clerkOrgId, input.clerkOrgId),
        eq(decisionSources.publicId, input.id)
      )
    )
    .limit(1);

  return row ? toDecisionDetail(row) : undefined;
}

export function decisionSearchTerms(query: string | undefined): string[] {
  if (!query) {
    return [];
  }

  return [
    ...new Set(
      query
        .trim()
        .split(/[\s/]+/)
        .map((term) => term.trim())
        .filter(Boolean)
    ),
  ].slice(0, MAX_QUERY_TERMS);
}

function decisionWhereConditions(
  clerkOrgId: string,
  input: ReturnType<typeof decisionFindInputSchema.parse>
) {
  const conditions = [
    eq(decisionSources.clerkOrgId, clerkOrgId),
    input.providers?.length
      ? inArray(decisionSources.provider, input.providers)
      : undefined,
    input.statuses?.length
      ? inArray(decisionSources.status, input.statuses)
      : undefined,
    input.sourceSurfaces?.length
      ? inArray(decisionSources.sourceSurface, input.sourceSurfaces)
      : undefined,
    input.since ? gte(decisionSources.startedAt, input.since) : undefined,
    input.until ? lte(decisionSources.startedAt, input.until) : undefined,
    input.cursor
      ? or(
          lt(decisionSources.createdAt, input.cursor.createdAt),
          and(
            eq(decisionSources.createdAt, input.cursor.createdAt),
            lt(decisionSources.id, input.cursor.id)
          )
        )
      : undefined,
    ...decisionSearchTerms(input.query).map(decisionSearchTermCondition),
  ];

  return conditions.filter(isDefined);
}

function decisionSearchTermCondition(term: string) {
  const pattern = `%${escapeLikePattern(term)}%`;
  return or(
    sql`${decisionSources.provider} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.providerToolName} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.routineId} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.calledById} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.calledByKind} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.calledByUserId} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.sourceSurface} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.sourceRef} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.sourceClientId} like ${pattern} escape '\\\\'`,
    sql`${decisionSources.status} like ${pattern} escape '\\\\'`
  );
}

function toDecisionRecord(row: ProviderRoutineCall): DecisionRecord {
  const title = titleFromToolName(row.providerToolName);
  const classification = classifyRoutine({
    provider: row.provider,
    providerToolName: row.providerToolName,
  });

  return {
    ...row,
    classification,
    decisionId: row.publicId,
    inputPayload: row.inputPayload ?? row.legacyInputRedacted,
    outputPayload: row.outputPayload ?? row.legacyOutputRedacted,
    snippet: buildDecisionSnippet({
      provider: row.provider,
      sourceSurface: row.sourceSurface,
      status: row.status,
      title,
    }),
    title,
  };
}

function toDecisionSummary(record: DecisionRecord): DecisionSummary {
  return {
    calledById: record.calledById,
    calledByKind: record.calledByKind,
    calledByUserId: record.calledByUserId,
    classification: record.classification,
    createdAt: record.createdAt,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    finishedAt: record.finishedAt,
    id: record.decisionId,
    provider: record.provider,
    providerToolName: record.providerToolName,
    routineId: record.routineId,
    snippet: record.snippet,
    sourceSurface: record.sourceSurface,
    startedAt: record.startedAt,
    status: record.status,
    title: record.title,
  };
}

function toDecisionDetail(row: ProviderRoutineCall): DecisionDetail {
  const record = toDecisionRecord(row);
  return {
    ...toDecisionSummary(record),
    inputRedacted: record.inputPayload,
    outputRedacted: record.outputPayload,
    providerActorId: row.providerActorId,
    providerAttempted: row.providerAttempted,
    providerConnectionId: row.providerConnectionId,
    providerRoutineCallId: row.publicId,
    providerWorkspaceId: row.providerWorkspaceId,
    sourceClientId: row.sourceClientId,
    sourceRef: row.sourceRef,
    updatedAt: row.updatedAt,
  };
}

function titleFromToolName(providerToolName: string) {
  return providerToolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildDecisionSnippet(input: {
  provider: string;
  sourceSurface: string;
  status: string;
  title: string;
}) {
  return `${providerLabel(input.provider)} / ${input.title} ${input.status} from ${sourceLabel(input.sourceSurface)}`;
}

function providerLabel(provider: string) {
  switch (provider) {
    case "linear":
      return "Linear";
    case "x":
      return "X";
    default:
      return provider;
  }
}

function sourceLabel(surface: string) {
  return surface
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
