import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("signals TanStack adapter boundary", () => {
  it("exports signal server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/signals");
    expect(packageJson.exports).toHaveProperty("./tanstack/signal-views");
    expect(packageJson.exports).toHaveProperty("./tanstack/people-views");
  });

  it("defines signal server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/signals.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("createSignalCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });

  it("defines view server functions in the api/app adapter layer", () => {
    const signalViewsSource = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/signal-views.ts"),
      "utf8"
    );
    const peopleViewsSource = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/people-views.ts"),
      "utf8"
    );

    expect(signalViewsSource).toContain('from "@tanstack/react-start"');
    expect(signalViewsSource).toContain("createServerFn");
    expect(signalViewsSource).toContain("listSignalViews");
    expect(signalViewsSource).not.toContain("TRPCError");

    expect(peopleViewsSource).toContain('from "@tanstack/react-start"');
    expect(peopleViewsSource).toContain("createServerFn");
    expect(peopleViewsSource).toContain("listPeopleViews");
    expect(peopleViewsSource).not.toContain("TRPCError");
  });
});
