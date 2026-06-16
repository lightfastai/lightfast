import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("workspace signals tRPC router", () => {
  it("keeps only signal views after the signal row migration", () => {
    const source = readFileSync(
      resolve(apiRoot, "router/(pending-not-allowed)/workspace-signals.ts"),
      "utf8"
    );

    expect(source).toContain("views: workspaceSignalViewsRouter");
    expect(source).not.toContain("listSignals(");
    expect(source).not.toContain("listWorkspaceSignals(");
    expect(source).not.toContain("getVisibleSignalByPublicId(");
    expect(source).not.toContain("createSignalForActor(");
  });
});
