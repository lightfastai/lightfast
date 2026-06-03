import { describe, expect, it } from "vitest";
import {
  classifyLinearRoutine,
  classifyXRoutine,
  hasRoutineScope,
} from "../policy";

describe("provider routine policy", () => {
  it("lets write scope satisfy read routines", () => {
    expect(
      hasRoutineScope({
        classification: "read",
        scopes: { providerRoutineRead: true, providerRoutineWrite: false },
      })
    ).toBe(true);
    expect(
      hasRoutineScope({
        classification: "read",
        scopes: { providerRoutineRead: false, providerRoutineWrite: true },
      })
    ).toBe(true);
  });

  it("requires write scope for write and unknown routines", () => {
    expect(
      hasRoutineScope({
        classification: "write",
        scopes: { providerRoutineRead: true, providerRoutineWrite: false },
      })
    ).toBe(false);
    expect(
      hasRoutineScope({
        classification: "unknown_write_default",
        scopes: { providerRoutineRead: true, providerRoutineWrite: false },
      })
    ).toBe(false);
  });

  it("classifies known Linear routines and defaults unknown names to write", () => {
    expect(classifyLinearRoutine("list_issues")).toBe("read");
    expect(classifyLinearRoutine("create_issue")).toBe("write");
    expect(classifyLinearRoutine("some_future_tool")).toBe(
      "unknown_write_default"
    );
  });

  it("classifies known X routines with read/write prefixes", () => {
    expect(classifyXRoutine("getUsersMe")).toBe("read");
    expect(classifyXRoutine("list_users")).toBe("read");
    expect(classifyXRoutine("post_status_update")).toBe("write");
    expect(classifyXRoutine("some_future_tool")).toBe("read");
  });
});
