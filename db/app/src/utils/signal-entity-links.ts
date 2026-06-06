import type { SignalEntityLinkCandidate } from "@repo/ai/signal-entity-linker";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

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

export type SignalEntityLinkReconciliationPerson = Pick<
  Person,
  "displayName" | "normalizedIdentityValue"
>;

const SIGNAL_ENTITY_LINK_RECONCILE_BATCH_SIZE = 500;
type SignalEntityLinkResolutionDb = Pick<Database, "select">;

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
        .flatMap((person) => [
          person.normalizedIdentityValue,
          person.displayName
            ? normalizeDisplayNameMention(person.displayName)
            : undefined,
        ])
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
    const unresolvedLinks = await db
      .select()
      .from(signalEntityLinks)
      .where(
        and(
          eq(signalEntityLinks.clerkOrgId, input.clerkOrgId),
          isNull(signalEntityLinks.resolvedPersonId),
          inArray(signalEntityLinks.normalizedMentionValue, normalizedValues),
          gt(signalEntityLinks.id, lastSeenLinkId)
        )
      )
      .orderBy(asc(signalEntityLinks.id))
      .limit(SIGNAL_ENTITY_LINK_RECONCILE_BATCH_SIZE);

    if (unresolvedLinks.length === 0) {
      break;
    }

    const linkHints = unresolvedLinks.map((link) => ({
      hints: buildSignalEntityLinkResolutionHints(link),
      link,
    }));
    const lookup = await loadSignalEntityLinkResolutionLookup(db, {
      clerkOrgId: input.clerkOrgId,
      hints: linkHints.map(({ hints }) => hints),
    });

    for (const { hints, link } of linkHints) {
      lastSeenLinkId = Math.max(lastSeenLinkId, link.id);
      const resolvedPerson = resolveSignalEntityLinkHints(lookup, hints);
      if (!resolvedPerson) {
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
            eq(signalEntityLinks.id, link.id),
            isNull(signalEntityLinks.resolvedPersonId)
          )
        );
      resolved += getRowsAffected(result);
    }

    if (unresolvedLinks.length < SIGNAL_ENTITY_LINK_RECONCILE_BATCH_SIZE) {
      break;
    }
  }

  return { resolved };
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
  peopleByDisplayName: Map<string, Person[]>;
  peopleByIdentityKey: Map<string, Person>;
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

function resolveSignalEntityLinkHints(
  lookup: SignalEntityLinkResolutionLookup,
  hints: SignalEntityLinkResolutionHints
): Person | null {
  if (hints.identityKeys.length > 0) {
    const matches = new Map<string, Person>();
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
  lookup: Map<string, Person[]>,
  key: string,
  person: Person
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
