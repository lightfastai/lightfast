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
  const values: InsertSignalEntityLink[] = [];

  for (const candidate of input.candidates) {
    const resolvedPerson = await resolveSignalEntityLinkCandidate(db, {
      candidate,
      clerkOrgId: input.clerkOrgId,
    });
    const hints = buildSignalEntityLinkResolutionHints(candidate);

    values.push({
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
    });
  }

  await db.transaction(async (tx) => {
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

    for (const link of unresolvedLinks) {
      lastSeenLinkId = Math.max(lastSeenLinkId, link.id);
      const resolvedPerson = await resolveSignalEntityLinkRecord(db, {
        clerkOrgId: input.clerkOrgId,
        link,
      });
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

async function resolveSignalEntityLinkCandidate(
  db: Database,
  input: { candidate: SignalEntityLinkCandidate; clerkOrgId: string }
): Promise<Person | null> {
  const hints = buildSignalEntityLinkResolutionHints(input.candidate);
  return resolveSignalEntityLinkHints(db, {
    clerkOrgId: input.clerkOrgId,
    hints,
  });
}

async function resolveSignalEntityLinkRecord(
  db: Database,
  input: { clerkOrgId: string; link: SignalEntityLink }
): Promise<Person | null> {
  return resolveSignalEntityLinkHints(db, {
    clerkOrgId: input.clerkOrgId,
    hints: buildSignalEntityLinkResolutionHints(input.link),
  });
}

async function resolveSignalEntityLinkHints(
  db: Database,
  input: { clerkOrgId: string; hints: SignalEntityLinkResolutionHints }
): Promise<Person | null> {
  if (input.hints.identityKeys.length > 0) {
    const [person, secondPerson] = await db
      .select()
      .from(people)
      .where(
        and(
          eq(people.clerkOrgId, input.clerkOrgId),
          inArray(people.identityKey, input.hints.identityKeys)
        )
      )
      .limit(2);

    if (person && !secondPerson) {
      return person;
    }
  }

  if (input.hints.displayName) {
    const [person, secondPerson] = await db
      .select()
      .from(people)
      .where(
        and(
          eq(people.clerkOrgId, input.clerkOrgId),
          sql`LOWER(TRIM(${people.displayName})) = ${input.hints.displayName}`
        )
      )
      .limit(2);

    if (person && !secondPerson) {
      return person;
    }
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
