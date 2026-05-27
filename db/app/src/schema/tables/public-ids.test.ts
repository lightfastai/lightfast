import { SIGNAL_ID_PREFIX } from "@repo/api-contract";
import { describe, expect, it } from "vitest";

import { createPersonId, PERSON_ID_PREFIX } from "./people";
import { createSignalId } from "./signals";

const PUBLIC_ID_COLUMN_LENGTH = 64;

describe("public id generators", () => {
  it("creates long-prefixed public ids that fit current varchar columns", () => {
    const signalId = createSignalId();
    const personId = createPersonId();

    expect(signalId.startsWith(SIGNAL_ID_PREFIX)).toBe(true);
    expect(personId.startsWith(PERSON_ID_PREFIX)).toBe(true);
    expect(signalId).toMatch(
      /^signal_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(personId).toMatch(
      /^person_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(signalId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
    expect(personId.length).toBeLessThanOrEqual(PUBLIC_ID_COLUMN_LENGTH);
  });
});
