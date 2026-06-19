import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("developer-connections TanStack adapter boundary", () => {
  it("exports developer-connection server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty(
      "./tanstack/developer-connections"
    );
  });

  it("defines developer-connection server functions in the adapter layer", () => {
    const source = readFileSync(
      resolve(
        repoRoot,
        "api/app/src/adapters/tanstack/developer-connections.ts"
      ),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("listDeveloperConnectionsCommand");
    expect(source).toContain("connectDeveloperConnectionCommand");
    expect(source).toContain("startSentryDeveloperConnectionAuthCommand");
    expect(source).toContain("completeSentryDeveloperConnectionAuthCommand");
    expect(source).toContain("setDeveloperConnectionSandboxEnabledCommand");
    expect(source).toContain("disconnectDeveloperConnectionCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });

  it("does not rebuild auth-shaped service contexts in developer-connection commands", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/domain/developer-connections/commands.ts"),
      "utf8"
    );

    expect(source).not.toContain("../../auth/identity");
    expect(source).not.toContain("AuthAccess");
    expect(source).not.toContain("AuthIdentity");
    expect(source).not.toContain("headers: Headers");
    expect(source).not.toContain("accessForActor");
  });
});
