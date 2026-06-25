import { describe, expect, it } from "vitest";
import {
  classifyLinearRoutine,
  classifyXRoutine,
  hasRoutineScope,
} from "../services/provider-routines/policy";

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
    expect(classifyLinearRoutine("save_initiative")).toBe("write");
    expect(classifyLinearRoutine("some_future_tool")).toBe(
      "unknown_write_default"
    );
  });

  it("classifies known X reads, known X writes, and unknown X names", () => {
    expect(classifyXRoutine("getUsersMe")).toBe("read");
    expect(classifyXRoutine("searchPostsRecent")).toBe("read");
    expect(classifyXRoutine("createPost")).toBe("write");
    expect(classifyXRoutine("deletePost")).toBe("write");
    expect(classifyXRoutine("followUser")).toBe("write");
    expect(classifyXRoutine("sendDmByConversation")).toBe("write");
    expect(classifyXRoutine("createCommunityNote")).toBe("write");
    expect(classifyXRoutine("someFutureXTool")).toBe("unknown_write_default");
  });
});
