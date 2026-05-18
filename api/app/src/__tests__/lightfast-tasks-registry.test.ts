import { describe, expect, it } from "vitest";

import {
  LIGHTFAST_REQUIRED_TASK_KEYS,
  LIGHTFAST_TASKS,
  lightfastTaskKeySchema,
} from "../auth/lightfast-tasks/registry";

describe("LIGHTFAST_TASKS", () => {
  it("registers connect-github as required", () => {
    expect(LIGHTFAST_TASKS).toEqual([
      { key: "connect-github", label: "Connect GitHub" },
    ]);
    expect(LIGHTFAST_REQUIRED_TASK_KEYS).toEqual(["connect-github"]);
  });
});

describe("lightfastTaskKeySchema", () => {
  it("accepts known keys", () => {
    expect(lightfastTaskKeySchema.safeParse("connect-github").success).toBe(
      true
    );
  });

  it("rejects unknown keys", () => {
    expect(lightfastTaskKeySchema.safeParse("nope").success).toBe(false);
    expect(lightfastTaskKeySchema.safeParse("").success).toBe(false);
  });
});
