import type { SignalEntityLinkCandidate } from "@repo/ai/signal-entity-linker";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  type InsertSignalEntityLink,
  type Person,
  type PersonIdentityProvider,
  orgPeople as people,
  SIGNAL_ENTITY_LINK_ANCHOR_TEXT_LENGTH,
  SIGNAL_ENTITY_LINK_LABEL_LENGTH,
  SIGNAL_ENTITY_LINK_NORMALIZED_MENTION_VALUE_LENGTH,
  type SignalEntityLink,
  orgSignalEntityLinks as signalEntityLinks,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";
import {
  createPersonIdentityKey,
  normalizePersonIdentityCandidate,
} from "./people-identities";

export interface SignalEntityLinkResolutionHints {
  displayName: string | null;
  identityKeys: string[];
  normalizedMentionValue: string;
}

export interface ReplaceSignalEntityLinksInput {
  candidates: SignalEntityLinkCandidate[];
  clerkOrgId: string;
  signalId: string;
}

export interface ReplaceSignalEntityLinksResult {
  links: number;
  resolved: number;
}

export interface SignalEntityLinkResolvedPerson {
  displayName: string | null;
  id: string;
  identityProvider: Person["identityProvider"];
  identityType: Person["identityType"];
  identityValue: string;
}

export interface SignalEntityLinkDetail {
  anchorOccurrence: number;
  anchorText: string;
  confidence: number;
  extractionMethod: SignalEntityLink["extractionMethod"];
  label: string;
  localEntityKey: string;
  mentionKind: SignalEntityLink["mentionKind"];
  rationale: string;
  resolvedPerson: SignalEntityLinkResolvedPerson | null;
  targetType: SignalEntityLink["targetType"];
}

type SignalEntityLinkResolutionPerson = Pick<
  Person,
  | "displayName"
  | "identityKey"
  | "metadata"
  | "normalizedIdentityValue"
  | "publicId"
>;
export type SignalEntityLinkReconciliationPerson =
  SignalEntityLinkResolutionPerson;

const SIGNAL_ENTITY_LINK_RECONCILE_BATCH_SIZE = 500;
const MAX_ENRICHMENT_TARGETS_PER_PROVIDER = 10;
const RESERVED_X_TWITTER_PATH_SEGMENTS = new Set([
  "compose",
  "download",
  "explore",
  "home",
  "i",
  "intent",
  "login",
  "logout",
  "messages",
  "notifications",
  "privacy",
  "search",
  "settings",
  "share",
  "signup",
  "tos",
]);
type SignalEntityLinkResolutionDb = Pick<Database, "select">;

export interface SignalEntityEnrichmentTarget {
  linkIds: number[];
  normalizedValue: string;
  provider: "x" | "github";
  value: string;
}

export interface SignalEntityEnrichmentSkippedTarget {
  anchorText: string;
  linkId: number;
  mentionKind: SignalEntityLink["mentionKind"];
  reason:
    | "already_resolved"
    | "unsupported_mention_kind"
    | "unsupported_profile_url"
    | "ambiguous_handle"
    | "over_cap";
}

export interface SignalEntityEnrichmentTargetsResult {
  github: SignalEntityEnrichmentTarget[];
  skipped: SignalEntityEnrichmentSkippedTarget[];
  x: SignalEntityEnrichmentTarget[];
}

export function buildSignalEntityLinkResolutionHints(
  candidate: Pick<
    SignalEntityLinkCandidate,
    "anchorText" | "label" | "mentionKind"
  >
): SignalEntityLinkResolutionHints {
  if (candidate.mentionKind === "email") {
    const normalized = normalizePersonIdentityCandidate({
      identityProvider: "email",
      identityType: "email",
      identityValue: candidate.anchorText,
    });

    if (normalized) {
      return {
        displayName: null,
        identityKeys: [createPersonIdentityKey(normalized)],
        normalizedMentionValue: clampNormalizedMention(
          normalized.normalizedIdentityValue
        ),
      };
    }
  }

  if (candidate.mentionKind === "handle") {
    const normalizedHandle = normalizeHandleMention(candidate.anchorText);
    const identityKeys = (["x", "github"] as const)
      .map((identityProvider) =>
        normalizePersonIdentityCandidate({
          identityProvider,
          identityType: "handle",
          identityValue: normalizedHandle,
        })
      )
      .filter(isDefined)
      .map(createPersonIdentityKey);

    return {
      displayName: null,
      identityKeys,
      normalizedMentionValue: clampNormalizedMention(normalizedHandle),
    };
  }

  if (candidate.mentionKind === "profile_url") {
    const identityProvider = inferProfileUrlProvider(candidate.anchorText);
    const normalized = identityProvider
      ? normalizePersonIdentityCandidate({
          identityProvider,
          identityType: "profile_url",
          identityValue: candidate.anchorText,
        })
      : undefined;

    if (normalized) {
      return {
        displayName: null,
        identityKeys: [createPersonIdentityKey(normalized)],
        normalizedMentionValue: clampNormalizedMention(
          normalized.normalizedIdentityValue
        ),
      };
    }
  }

  const displayName = normalizeDisplayNameMention(candidate.anchorText);
  return {
    displayName,
    identityKeys: [],
    normalizedMentionValue: clampNormalizedMention(
      displayName || normalizeMentionText(candidate.label)
    ),
  };
}

export async function replaceSignalEntityLinks(
  db: Database,
  input: ReplaceSignalEntityLinksInput
): Promise<ReplaceSignalEntityLinksResult> {
  const now = new Date();
  const candidateHints = input.candidates.map((candidate) => ({
    candidate,
    hints: buildSignalEntityLinkResolutionHints(candidate),
  }));
  let values: InsertSignalEntityLink[] = [];

  await db.transaction(async (tx) => {
    const lookup = await loadSignalEntityLinkResolutionLookup(tx, {
      clerkOrgId: input.clerkOrgId,
      hints: candidateHints.map(({ hints }) => hints),
    });
    values = candidateHints.map(({ candidate, hints }) => {
      const resolvedPerson = resolveSignalEntityLinkHints(lookup, hints);

      return {
        anchorOccurrence: candidate.anchorOccurrence,
        anchorText: truncate(
          candidate.anchorText,
          SIGNAL_ENTITY_LINK_ANCHOR_TEXT_LENGTH
        ),
        clerkOrgId: input.clerkOrgId,
        confidenceBasisPoints: toBasisPoints(candidate.confidence),
        extractionMethod: candidate.extractionMethod,
        label: truncate(candidate.label, SIGNAL_ENTITY_LINK_LABEL_LENGTH),
        localEntityKey: candidate.localEntityKey,
        mentionKind: candidate.mentionKind,
        normalizedMentionValue: hints.normalizedMentionValue,
        rationale: candidate.rationale,
        resolvedAt: resolvedPerson ? now : null,
        resolvedPersonId: resolvedPerson?.publicId ?? null,
        signalId: input.signalId,
        targetType: candidate.targetType,
      };
    });

    await tx
      .delete(signalEntityLinks)
      .where(
        and(
          eq(signalEntityLinks.clerkOrgId, input.clerkOrgId),
          eq(signalEntityLinks.signalId, input.signalId)
        )
      );

    if (values.length > 0) {
      await tx.insert(signalEntityLinks).values(values);
    }
  });

  return {
    links: values.length,
    resolved: values.filter((value) => value.resolvedPersonId !== null).length,
  };
}

export async function reconcileSignalEntityLinksForPeople(
  db: Database,
  input: {
    clerkOrgId: string;
    people: SignalEntityLinkReconciliationPerson[];
  }
): Promise<{ resolved: number }> {
  const normalizedValues = Array.from(
    new Set(
      input.people
        .flatMap(normalizedMentionValuesForReconciliationPerson)
        .filter(isDefined)
        .filter((value) => value.length > 0)
    )
  );

  if (normalizedValues.length === 0) {
    return { resolved: 0 };
  }

  let resolved = 0;
  const resolvedAt = new Date();
  let lastSeenLinkId = 0;

  while (true) {
    const matchingLinks = await db
      .select()
      .from(signalEntityLinks)
      .where(
        and(
          eq(signalEntityLinks.clerkOrgId, input.clerkOrgId),
          inArray(signalEntityLinks.normalizedMentionValue, normalizedValues),
          gt(signalEntityLinks.id, lastSeenLinkId)
        )
      )
      .orderBy(asc(signalEntityLinks.id))
      .limit(SIGNAL_ENTITY_LINK_RECONCILE_BATCH_SIZE);

    if (matchingLinks.length === 0) {
      break;
    }

    const linkHints = matchingLinks.map((link) => ({
      hints: buildSignalEntityLinkResolutionHints(link),
      link,
    }));
    const lookup = await loadSignalEntityLinkResolutionLookup(db, {
      clerkOrgId: input.clerkOrgId,
      hints: linkHints.map(({ hints }) => hints),
    });
    addReconciliationPeopleToLookup(lookup, input.people);

    for (const { hints, link } of linkHints) {
      lastSeenLinkId = Math.max(lastSeenLinkId, link.id);
      const resolvedPerson = resolveSignalEntityLinkHints(lookup, hints);
      if (!resolvedPerson) {
        continue;
      }
      if (link.resolvedPersonId === resolvedPerson.publicId) {
        continue;
      }

      const result = await db
        .update(signalEntityLinks)
        .set({
          resolvedAt,
          resolvedPersonId: resolvedPerson.publicId,
        })
        .where(
          and(
            eq(signalEntityLinks.clerkOrgId, input.clerkOrgId),
            eq(signalEntityLinks.id, link.id)
          )
        );
      resolved += getRowsAffected(result);
    }

    if (matchingLinks.length < SIGNAL_ENTITY_LINK_RECONCILE_BATCH_SIZE) {
      break;
    }
  }

  return { resolved };
}

export async function listSignalEntityEnrichmentTargets(
  db: Database,
  input: { clerkOrgId: string; signalId: string }
): Promise<SignalEntityEnrichmentTargetsResult> {
  const rows = await db
    .select()
    .from(signalEntityLinks)
    .where(
      and(
        eq(signalEntityLinks.clerkOrgId, input.clerkOrgId),
        eq(signalEntityLinks.signalId, input.signalId)
      )
    )
    .orderBy(asc(signalEntityLinks.id));

  const targetsByKey = new Map<string, SignalEntityEnrichmentTarget>();
  const skipped: SignalEntityEnrichmentSkippedTarget[] = [];

  for (const link of rows) {
    const parsed = enrichmentTargetFromLink(link);
    if ("reason" in parsed) {
      skipped.push(skippedTarget(link, parsed.reason));
      continue;
    }

    const normalizedValue = parsed.value.trim().toLowerCase();
    if (!normalizedValue) {
      skipped.push(skippedTarget(link, "unsupported_profile_url"));
      continue;
    }

    const targetKey = `${parsed.provider}:${normalizedValue}`;
    const existingTarget = targetsByKey.get(targetKey);
    if (existingTarget) {
      existingTarget.linkIds.push(link.id);
      continue;
    }

    targetsByKey.set(targetKey, {
      linkIds: [link.id],
      normalizedValue,
      provider: parsed.provider,
      value: normalizedValue,
    });
  }

  const x: SignalEntityEnrichmentTarget[] = [];
  const github: SignalEntityEnrichmentTarget[] = [];
  for (const target of targetsByKey.values()) {
    const providerTargets = target.provider === "x" ? x : github;
    if (providerTargets.length >= MAX_ENRICHMENT_TARGETS_PER_PROVIDER) {
      for (const linkId of target.linkIds) {
        const link = rows.find((row) => row.id === linkId);
        if (link) {
          skipped.push(skippedTarget(link, "over_cap"));
        }
      }
      continue;
    }
    providerTargets.push(target);
  }

  return { github, skipped, x };
}

export async function listSignalEntityLinksForSignal(
  db: Database,
  input: { clerkOrgId: string; signalId: string }
): Promise<SignalEntityLinkDetail[]> {
  const rows = await db
    .select({
      anchorOccurrence: signalEntityLinks.anchorOccurrence,
      anchorText: signalEntityLinks.anchorText,
      confidenceBasisPoints: signalEntityLinks.confidenceBasisPoints,
      extractionMethod: signalEntityLinks.extractionMethod,
      label: signalEntityLinks.label,
      localEntityKey: signalEntityLinks.localEntityKey,
      mentionKind: signalEntityLinks.mentionKind,
      personDisplayName: people.displayName,
      personIdentityProvider: people.identityProvider,
      personIdentityType: people.identityType,
      personIdentityValue: people.identityValue,
      personPublicId: people.publicId,
      rationale: signalEntityLinks.rationale,
      targetType: signalEntityLinks.targetType,
    })
    .from(signalEntityLinks)
    .leftJoin(
      people,
      and(
        eq(signalEntityLinks.clerkOrgId, people.clerkOrgId),
        eq(signalEntityLinks.resolvedPersonId, people.publicId)
      )
    )
    .where(
      and(
        eq(signalEntityLinks.clerkOrgId, input.clerkOrgId),
        eq(signalEntityLinks.signalId, input.signalId)
      )
    )
    .orderBy(asc(signalEntityLinks.id));

  return rows.map((row) => ({
    anchorOccurrence: row.anchorOccurrence,
    anchorText: row.anchorText,
    confidence: row.confidenceBasisPoints / 10_000,
    extractionMethod: row.extractionMethod,
    label: row.label,
    localEntityKey: row.localEntityKey,
    mentionKind: row.mentionKind,
    rationale: row.rationale,
    resolvedPerson: toResolvedPerson(row),
    targetType: row.targetType,
  }));
}

interface SignalEntityLinkResolutionLookup {
  peopleByDisplayName: Map<string, SignalEntityLinkResolutionPerson[]>;
  peopleByIdentityKey: Map<string, SignalEntityLinkResolutionPerson>;
}

async function loadSignalEntityLinkResolutionLookup(
  db: SignalEntityLinkResolutionDb,
  input: { clerkOrgId: string; hints: SignalEntityLinkResolutionHints[] }
): Promise<SignalEntityLinkResolutionLookup> {
  const identityKeys = Array.from(
    new Set(input.hints.flatMap((hints) => hints.identityKeys))
  );
  const displayNames = Array.from(
    new Set(input.hints.map((hints) => hints.displayName).filter(isNonNullish))
  );
  const peopleByIdentityKey = new Map<string, Person>();
  const peopleByDisplayName = new Map<string, Person[]>();

  if (identityKeys.length > 0) {
    const matchedPeople = await db
      .select()
      .from(people)
      .where(
        and(
          eq(people.clerkOrgId, input.clerkOrgId),
          inArray(people.identityKey, identityKeys)
        )
      );

    for (const person of matchedPeople) {
      peopleByIdentityKey.set(person.identityKey, person);
    }
  }

  if (displayNames.length > 0) {
    const matchedPeople = await db
      .select()
      .from(people)
      .where(
        and(
          eq(people.clerkOrgId, input.clerkOrgId),
          inArray(sql`LOWER(TRIM(${people.displayName}))`, displayNames)
        )
      );

    for (const person of matchedPeople) {
      if (person.displayName) {
        addPersonToLookup(
          peopleByDisplayName,
          normalizeDisplayNameMention(person.displayName),
          person
        );
      }
    }
  }

  return { peopleByDisplayName, peopleByIdentityKey };
}

function addReconciliationPeopleToLookup(
  lookup: SignalEntityLinkResolutionLookup,
  people: SignalEntityLinkResolutionPerson[]
) {
  for (const person of people) {
    for (const identityKey of identityKeysForReconciliationPerson(person)) {
      lookup.peopleByIdentityKey.set(identityKey, person);
    }

    if (person.displayName) {
      addPersonToLookup(
        lookup.peopleByDisplayName,
        normalizeDisplayNameMention(person.displayName),
        person
      );
    }
  }
}

function normalizedMentionValuesForReconciliationPerson(
  person: SignalEntityLinkResolutionPerson
): string[] {
  return [
    person.normalizedIdentityValue,
    person.displayName
      ? normalizeDisplayNameMention(person.displayName)
      : undefined,
    ...entityGraphSourceIdentityAliases(person.metadata).map(
      (alias) => alias.normalizedValue
    ),
  ].filter(isDefined);
}

function identityKeysForReconciliationPerson(
  person: SignalEntityLinkResolutionPerson
): string[] {
  return [
    person.identityKey,
    ...entityGraphSourceIdentityAliases(person.metadata)
      .map((alias) =>
        normalizePersonIdentityCandidate({
          identityProvider: alias.provider,
          identityType: "handle",
          identityValue: alias.normalizedValue,
        })
      )
      .filter(isDefined)
      .map(createPersonIdentityKey),
  ];
}

interface EntityGraphSourceIdentityAlias {
  normalizedValue: string;
  provider: Extract<PersonIdentityProvider, "github" | "x">;
}

function entityGraphSourceIdentityAliases(
  metadata: Record<string, unknown>
): EntityGraphSourceIdentityAlias[] {
  const entityGraph = readRecord(metadata.entityGraph);
  const sourceIdentities = Array.isArray(entityGraph?.sourceIdentities)
    ? entityGraph.sourceIdentities
    : [];

  return sourceIdentities
    .map((sourceIdentity) => {
      const record = readRecord(sourceIdentity);
      const provider = readString(record?.provider);
      const identityType = readString(record?.identityType);
      const normalizedValue = readString(record?.normalizedValue);

      if (
        !isXOrGitHubProvider(provider) ||
        identityType !== "handle" ||
        !normalizedValue
      ) {
        return null;
      }

      return {
        normalizedValue,
        provider,
      };
    })
    .filter(isNonNullish);
}

function isXOrGitHubProvider(
  value: string | null
): value is Extract<PersonIdentityProvider, "github" | "x"> {
  return value === "github" || value === "x";
}

function resolveSignalEntityLinkHints(
  lookup: SignalEntityLinkResolutionLookup,
  hints: SignalEntityLinkResolutionHints
): SignalEntityLinkResolutionPerson | null {
  if (hints.identityKeys.length > 0) {
    const matches = new Map<string, SignalEntityLinkResolutionPerson>();
    for (const identityKey of hints.identityKeys) {
      const person = lookup.peopleByIdentityKey.get(identityKey);
      if (person) {
        matches.set(person.publicId, person);
      }
    }

    if (matches.size === 1) {
      return firstMapValue(matches);
    }
  }

  if (hints.displayName) {
    const matches = lookup.peopleByDisplayName.get(hints.displayName) ?? [];
    if (matches.length === 1) {
      return matches[0] ?? null;
    }
  }

  return null;
}

function addPersonToLookup(
  lookup: Map<string, SignalEntityLinkResolutionPerson[]>,
  key: string,
  person: SignalEntityLinkResolutionPerson
) {
  const matches = lookup.get(key);
  if (!matches) {
    lookup.set(key, [person]);
    return;
  }

  if (!matches.some((match) => match.publicId === person.publicId)) {
    matches.push(person);
  }
}

function firstMapValue<TKey, TValue>(map: Map<TKey, TValue>): TValue | null {
  for (const value of map.values()) {
    return value;
  }
  return null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function inferProfileUrlProvider(
  value: string
): PersonIdentityProvider | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "x.com" || host === "twitter.com") {
    return "x";
  }
  if (host === "github.com") {
    return "github";
  }
  if (host === "linkedin.com") {
    return "linkedin";
  }
  if (url.protocol.startsWith("http")) {
    return "website";
  }
  return;
}

function enrichmentTargetFromLink(
  link: SignalEntityLink
):
  | { provider: "x" | "github"; value: string }
  | { reason: SignalEntityEnrichmentSkippedTarget["reason"] } {
  if (link.resolvedPersonId) {
    return { reason: "already_resolved" };
  }

  if (link.mentionKind === "handle") {
    const trimmed = link.anchorText.trim();
    return trimmed.startsWith("@")
      ? { provider: "x", value: trimmed.replace(/^@/, "") }
      : { reason: "ambiguous_handle" };
  }

  if (link.mentionKind !== "profile_url") {
    return { reason: "unsupported_mention_kind" };
  }

  return (
    profileEnrichmentTargetFromUrl(link.anchorText) ?? {
      reason: "unsupported_profile_url",
    }
  );
}

function profileEnrichmentTargetFromUrl(
  value: string
): { provider: "x" | "github"; value: string } | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return;
  }

  if (!(url.protocol === "https:" || url.protocol === "http:")) {
    return;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const profilePathSegment = pathSegments[0];
  if (pathSegments.length !== 1 || !profilePathSegment) {
    return;
  }

  if (host === "x.com" || host === "twitter.com") {
    const normalizedSegment = profilePathSegment.toLowerCase();
    if (RESERVED_X_TWITTER_PATH_SEGMENTS.has(normalizedSegment)) {
      return;
    }
    return { provider: "x", value: profilePathSegment };
  }

  if (host === "github.com") {
    return { provider: "github", value: profilePathSegment };
  }

  return;
}

function skippedTarget(
  link: SignalEntityLink,
  reason: SignalEntityEnrichmentSkippedTarget["reason"]
): SignalEntityEnrichmentSkippedTarget {
  return {
    anchorText: link.anchorText,
    linkId: link.id,
    mentionKind: link.mentionKind,
    reason,
  };
}

function toResolvedPerson(row: {
  personDisplayName: string | null;
  personIdentityProvider: Person["identityProvider"] | null;
  personIdentityType: Person["identityType"] | null;
  personIdentityValue: string | null;
  personPublicId: string | null;
}): SignalEntityLinkResolvedPerson | null {
  if (
    !(
      row.personPublicId &&
      row.personIdentityProvider &&
      row.personIdentityType &&
      row.personIdentityValue
    )
  ) {
    return null;
  }

  return {
    displayName: row.personDisplayName,
    id: row.personPublicId,
    identityProvider: row.personIdentityProvider,
    identityType: row.personIdentityType,
    identityValue: row.personIdentityValue,
  };
}

function normalizeDisplayNameMention(value: string): string {
  return normalizeMentionText(value);
}

function normalizeHandleMention(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function normalizeMentionText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function clampNormalizedMention(value: string): string {
  const normalized = normalizeMentionText(value);
  return truncate(
    normalized,
    SIGNAL_ENTITY_LINK_NORMALIZED_MENTION_VALUE_LENGTH
  );
}

function toBasisPoints(confidence: number): number {
  return Math.max(0, Math.min(10_000, Math.round(confidence * 10_000)));
}

function truncate(value: string, maxLength: number): string {
  return value.slice(0, maxLength);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isNonNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
