import { readFile } from "node:fs/promises";
import { z } from "zod";

import {
  type EntityConflict,
  type EntityResolutionResult,
  type EntityResolutionStatus,
  entityResolutionStatusSchema,
} from "./index";

const confidenceBandSchema = z
  .object({
    max: z.number().min(0).max(1),
    min: z.number().min(0).max(1),
  })
  .strict()
  .refine((value) => value.min <= value.max, {
    message: "Confidence band min must be <= max.",
  });

const goldenConflictSchema = z
  .object({
    kind: z.literal("business.affiliation"),
    values: z.array(z.string().trim().min(1)),
  })
  .strict();

const goldenPersonSchema = z
  .object({
    affiliations: z.array(z.string().trim().min(1)),
    confidence: confidenceBandSchema,
    conflicts: z.array(goldenConflictSchema).default([]),
    displayName: z.string().trim().min(1),
    status: entityResolutionStatusSchema,
  })
  .strict();

const goldenBusinessSchema = z
  .object({
    confidence: confidenceBandSchema,
    displayName: z.string().trim().min(1),
    domains: z.array(z.string().trim().min(1)).default([]),
    status: entityResolutionStatusSchema,
  })
  .strict();

export const goldenEntityResolutionFixtureSchema = z
  .object({
    businesses: z.array(goldenBusinessSchema),
    people: z.array(goldenPersonSchema),
  })
  .strict();

export type ConfidenceBand = z.infer<typeof confidenceBandSchema>;
export type GoldenEntityResolutionFixture = z.infer<
  typeof goldenEntityResolutionFixtureSchema
>;

export interface GoldenFixtureIssue {
  actual?: unknown;
  expected?: unknown;
  message: string;
  path: string;
}

export interface GoldenFixtureCheckResult {
  issues: GoldenFixtureIssue[];
  passed: boolean;
}

const SIMULATED_GOLDEN_FIXTURE_URL = new URL(
  "../fixtures/simulated.expected.json",
  import.meta.url
);

export async function loadSimulatedGoldenFixture(): Promise<GoldenEntityResolutionFixture> {
  const raw = await readFile(SIMULATED_GOLDEN_FIXTURE_URL, "utf8");
  return goldenEntityResolutionFixtureSchema.parse(JSON.parse(raw));
}

export function checkEntityResolutionAgainstGolden(
  actual: EntityResolutionResult,
  expected: GoldenEntityResolutionFixture
): GoldenFixtureCheckResult {
  const issues: GoldenFixtureIssue[] = [];

  checkPeople(actual, expected, issues);
  checkBusinesses(actual, expected, issues);

  return {
    issues,
    passed: issues.length === 0,
  };
}

function checkPeople(
  actual: EntityResolutionResult,
  expected: GoldenEntityResolutionFixture,
  issues: GoldenFixtureIssue[]
): void {
  const actualPeople = new Map(
    actual.people.map((person) => [person.displayName, person])
  );
  const expectedPeople = new Map(
    expected.people.map((person) => [person.displayName, person])
  );

  for (const expectedPerson of expected.people) {
    const actualPerson = actualPeople.get(expectedPerson.displayName);
    const path = `people[${expectedPerson.displayName}]`;
    if (!actualPerson) {
      issues.push({
        expected: expectedPerson.displayName,
        message: `Missing expected person ${expectedPerson.displayName}.`,
        path,
      });
      continue;
    }

    checkStatus({
      actual: actualPerson.status,
      expected: expectedPerson.status,
      issues,
      path: `${path}.status`,
    });
    checkConfidence({
      actual: actualPerson.confidence,
      expected: expectedPerson.confidence,
      issues,
      path: `${path}.confidence`,
    });
    checkStringSet({
      actual: actualPerson.affiliations.map(
        (affiliation) => affiliation.businessName
      ),
      expected: expectedPerson.affiliations,
      issues,
      label: "affiliations",
      path: `${path}.affiliations`,
    });
    checkConflicts({
      actual: actualPerson.conflicts,
      expected: expectedPerson.conflicts,
      issues,
      path: `${path}.conflicts`,
    });
  }

  for (const actualPerson of actual.people) {
    if (!expectedPeople.has(actualPerson.displayName)) {
      issues.push({
        actual: actualPerson.displayName,
        message: `Received unexpected person ${actualPerson.displayName}.`,
        path: `people[${actualPerson.displayName}]`,
      });
    }
  }
}

function checkBusinesses(
  actual: EntityResolutionResult,
  expected: GoldenEntityResolutionFixture,
  issues: GoldenFixtureIssue[]
): void {
  const actualBusinesses = new Map(
    actual.businesses.map((business) => [business.displayName, business])
  );
  const expectedBusinesses = new Map(
    expected.businesses.map((business) => [business.displayName, business])
  );

  for (const expectedBusiness of expected.businesses) {
    const actualBusiness = actualBusinesses.get(expectedBusiness.displayName);
    const path = `businesses[${expectedBusiness.displayName}]`;
    if (!actualBusiness) {
      issues.push({
        expected: expectedBusiness.displayName,
        message: `Missing expected business ${expectedBusiness.displayName}.`,
        path,
      });
      continue;
    }

    checkStatus({
      actual: actualBusiness.status,
      expected: expectedBusiness.status,
      issues,
      path: `${path}.status`,
    });
    checkConfidence({
      actual: actualBusiness.confidence,
      expected: expectedBusiness.confidence,
      issues,
      path: `${path}.confidence`,
    });
    checkStringSet({
      actual: actualBusiness.domains,
      expected: expectedBusiness.domains,
      issues,
      label: "domains",
      path: `${path}.domains`,
    });
  }

  for (const actualBusiness of actual.businesses) {
    if (!expectedBusinesses.has(actualBusiness.displayName)) {
      issues.push({
        actual: actualBusiness.displayName,
        message: `Received unexpected business ${actualBusiness.displayName}.`,
        path: `businesses[${actualBusiness.displayName}]`,
      });
    }
  }
}

function checkStatus(input: {
  actual: EntityResolutionStatus;
  expected: EntityResolutionStatus;
  issues: GoldenFixtureIssue[];
  path: string;
}): void {
  if (input.actual === input.expected) {
    return;
  }
  input.issues.push({
    actual: input.actual,
    expected: input.expected,
    message: `Expected status ${input.expected}, received ${input.actual}.`,
    path: input.path,
  });
}

function checkConfidence(input: {
  actual: number;
  expected: ConfidenceBand;
  issues: GoldenFixtureIssue[];
  path: string;
}): void {
  if (
    input.actual >= input.expected.min &&
    input.actual <= input.expected.max
  ) {
    return;
  }
  input.issues.push({
    actual: input.actual,
    expected: input.expected,
    message: `Expected confidence in [${input.expected.min}, ${input.expected.max}], received ${input.actual}.`,
    path: input.path,
  });
}

function checkStringSet(input: {
  actual: string[];
  expected: string[];
  issues: GoldenFixtureIssue[];
  label: string;
  path: string;
}): void {
  const actual = sorted(input.actual);
  const expected = sorted(input.expected);
  if (sameStringArray(actual, expected)) {
    return;
  }
  input.issues.push({
    actual,
    expected,
    message: `Expected ${input.label} ${expected.join(", ")}, received ${actual.join(", ")}.`,
    path: input.path,
  });
}

function checkConflicts(input: {
  actual: EntityConflict[];
  expected: EntityConflict[];
  issues: GoldenFixtureIssue[];
  path: string;
}): void {
  if (input.expected.length !== input.actual.length) {
    input.issues.push({
      actual: input.actual,
      expected: input.expected,
      message: `Expected ${input.expected.length} conflicts, received ${input.actual.length}.`,
      path: input.path,
    });
    return;
  }

  for (const [index, expectedConflict] of input.expected.entries()) {
    const actualConflict = input.actual[index];
    const path = `${input.path}[${index}]`;
    if (!actualConflict) {
      input.issues.push({
        expected: expectedConflict,
        message: `Missing expected conflict at index ${index}.`,
        path,
      });
      continue;
    }
    if (actualConflict.kind !== expectedConflict.kind) {
      input.issues.push({
        actual: actualConflict.kind,
        expected: expectedConflict.kind,
        message: `Expected conflict kind ${expectedConflict.kind}, received ${actualConflict.kind}.`,
        path: `${path}.kind`,
      });
    }
    checkStringSet({
      actual: actualConflict.values,
      expected: expectedConflict.values,
      issues: input.issues,
      label: "conflict values",
      path: `${path}.values`,
    });
  }
}

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}
