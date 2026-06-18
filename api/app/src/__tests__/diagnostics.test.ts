import { describe, expect, it } from "vitest";

import { createDiagnosticCause, isDiagnosticCause } from "../diagnostics";

describe("diagnostics", () => {
  it("creates a transport-neutral diagnostic cause", () => {
    const cause = createDiagnosticCause({
      code: "ORG_REQUIRED",
      message: "Organization required.",
      repair: { id: "create-or-join-org" },
    });

    expect(isDiagnosticCause(cause)).toBe(true);
    expect(cause.diagnostics).toEqual([
      {
        code: "ORG_REQUIRED",
        message: "Organization required.",
        repair: { id: "create-or-join-org" },
      },
    ]);
  });
});
