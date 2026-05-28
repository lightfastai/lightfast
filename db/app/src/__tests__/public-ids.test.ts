import { SIGNAL_ID_PREFIX } from "@repo/api-contract";
import { describe, expect, it } from "vitest";

import {
  AUTOMATION_ID_PREFIX,
  AUTOMATION_RUN_ID_PREFIX,
  createAutomationId,
  createAutomationRunId,
} from "../schema/tables/automations";
import { createPersonId, PERSON_ID_PREFIX } from "../schema/tables/people";
import { createSignalId } from "../schema/tables/signals";

const PUBLIC_ID_COLUMN_LENGTH = 80;

describe("public id generators", () => {
  it("creates long-prefixed public ids that fit current varchar columns", () => {
    const automationId = createAutomationId();
    const automationRunId = createAutomationRunId();
    const signalId = createSignalId();
    const personId = createPersonId();

    expect(automationId.startsWith(AUTOMATION_ID_PREFIX)).toBe(true);
    expect(automationRunId.startsWith(AUTOMATION_RUN_ID_PREFIX)).toBe(true);
    expect(signalId.startsWith(SIGNAL_ID_PREFIX)).toBe(true);
    expect(personId.startsWith(PERSON_ID_PREFIX)).toBe(true);
    expect(automationId).toMatch(
      /^automation_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(automationRunId).toMatch(
      /^automation_run_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(signalId).toMatch(
      /^signal_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(personId).toMatch(
      /^person_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(automationId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(automationRunId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(signalId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(personId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
  });
});
