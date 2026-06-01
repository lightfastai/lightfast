import { describe, expect, it } from "vitest";

import {
  canTransitionNamespaceOperation,
  getNextNamespaceOperationStatus,
  isTerminalNamespaceOperationStatus,
  NamespaceOperationTransitionError,
} from "../utils/namespaces";

describe("namespace operation state machine", () => {
  it.each([
    ["started", "FAIL", "failed"],
    ["started", "RESERVE_NAMESPACE", "namespace_reserved"],
    ["namespace_reserved", "MARK_CLERK_APPLIED", "clerk_applied"],
    ["namespace_reserved", "DELETE_PRE_CLERK_RESERVATION", "failed"],
    ["clerk_applied", "FINALIZE", "finalized"],
    ["clerk_applied", "COMPENSATE", "compensating"],
    ["compensating", "FINALIZE", "finalized"],
    ["compensating", "FAIL", "failed"],
  ] as const)("transitions %s via %s to %s", (from, event, to) => {
    expect(getNextNamespaceOperationStatus(from, { type: event })).toBe(to);
    expect(canTransitionNamespaceOperation(from, { type: event })).toBe(true);
  });

  it.each([
    ["started", "FINALIZE"],
    ["namespace_reserved", "FAIL"],
    ["namespace_reserved", "FINALIZE"],
    ["failed", "RESERVE_NAMESPACE"],
    ["finalized", "FAIL"],
  ] as const)("rejects illegal transition %s via %s", (from, event) => {
    expect(canTransitionNamespaceOperation(from, { type: event })).toBe(false);
    expect(() =>
      getNextNamespaceOperationStatus(from, { type: event })
    ).toThrow(NamespaceOperationTransitionError);
  });

  it("identifies terminal statuses", () => {
    expect(isTerminalNamespaceOperationStatus("finalized")).toBe(true);
    expect(isTerminalNamespaceOperationStatus("failed")).toBe(true);
    expect(isTerminalNamespaceOperationStatus("started")).toBe(false);
  });
});
