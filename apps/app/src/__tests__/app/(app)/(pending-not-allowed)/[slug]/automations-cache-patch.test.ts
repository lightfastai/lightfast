import type { Automation } from "@db/app/schema";
import { describe, expect, it } from "vitest";
import { applyAutomationPatch } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache";

function make(over: Partial<Automation>): Automation {
  return {
    name: "Old name",
    prompt: "Old prompt",
    ...over,
  } as unknown as Automation;
}

describe("applyAutomationPatch", () => {
  it("patches only the name", () => {
    const result = applyAutomationPatch(make({}), { name: "New name" });
    expect(result.name).toBe("New name");
    expect(result.prompt).toBe("Old prompt");
  });

  it("patches only the prompt", () => {
    const result = applyAutomationPatch(make({}), { prompt: "New prompt" });
    expect(result.prompt).toBe("New prompt");
    expect(result.name).toBe("Old name");
  });

  it("leaves fields untouched when the patch has neither key", () => {
    const result = applyAutomationPatch(make({}), {});
    expect(result.name).toBe("Old name");
    expect(result.prompt).toBe("Old prompt");
  });

  it("ignores undefined values (does not blank a field)", () => {
    const result = applyAutomationPatch(make({}), { name: undefined });
    expect(result.name).toBe("Old name");
  });
});
