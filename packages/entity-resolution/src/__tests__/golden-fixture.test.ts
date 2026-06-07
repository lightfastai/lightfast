import { describe, expect, it } from "vitest";

import {
  checkEntityResolutionAgainstGolden,
  loadSimulatedGoldenFixture,
} from "../golden";
import { resolveSimulatedEntityFixture } from "../index";

describe("@repo/entity-resolution golden fixture checker", () => {
  it("passes the checked-in simulated golden fixture", async () => {
    const result = resolveSimulatedEntityFixture();
    const expected = await loadSimulatedGoldenFixture();
    const check = checkEntityResolutionAgainstGolden(result, expected);

    expect(check).toEqual({ issues: [], passed: true });
  });

  it("reports focused diffs for status, confidence, and affiliation drift", async () => {
    const result = resolveSimulatedEntityFixture();
    const expected = await loadSimulatedGoldenFixture();
    const ava = expected.people.find(
      (person) => person.displayName === "Ava Chen"
    );
    if (!ava) {
      throw new Error("Expected Ava Chen in simulated golden fixture.");
    }
    ava.status = "possible";
    ava.confidence = { min: 0.1, max: 0.2 };
    ava.affiliations = ["Not Acme"];

    const check = checkEntityResolutionAgainstGolden(result, expected);

    expect(check.passed).toBe(false);
    expect(check.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "people[Ava Chen].status",
          message: "Expected status possible, received likely.",
        }),
        expect.objectContaining({
          path: "people[Ava Chen].confidence",
          message: "Expected confidence in [0.1, 0.2], received 0.92.",
        }),
        expect.objectContaining({
          path: "people[Ava Chen].affiliations",
          message: "Expected affiliations Not Acme, received Acme.",
        }),
      ])
    );
  });
});
