import { describe, expect, it } from "vitest";

import { EVENT_REGISTRY } from "../registry";
import { EVENT_LABELS } from "./event-labels";

describe("EVENT_LABELS sync", () => {
  it("every EVENT_REGISTRY key exists in EVENT_LABELS", () => {
    for (const key of Object.keys(EVENT_REGISTRY)) {
      expect(EVENT_LABELS, `missing key: ${key}`).toHaveProperty(key);
    }
  });

  it("labels match EVENT_REGISTRY entries", () => {
    for (const [key, entry] of Object.entries(EVENT_REGISTRY)) {
      expect(
        EVENT_LABELS[key as keyof typeof EVENT_LABELS],
        `label mismatch for key: ${key}`
      ).toBe(entry.label);
    }
  });
});
