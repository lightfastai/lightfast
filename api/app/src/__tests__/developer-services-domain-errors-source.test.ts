import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("developer service domain errors", () => {
  it("keeps developer service errors framework-neutral", () => {
    for (const file of [
      "services/developer-connections/auth-box.ts",
      "services/developer-connections/leases.ts",
      "services/developer-sandbox-runs/index.ts",
    ]) {
      const fileSource = source(file);

      expect(fileSource, file).toContain("../../domain/errors");
      expect(fileSource, file).not.toContain("@trpc/server");
      expect(fileSource, file).not.toContain("TRPCError");
    }

    const developerConnectionSource = source(
      "services/developer-connections/index.ts"
    );
    expect(developerConnectionSource).not.toContain("@trpc/server");
    expect(developerConnectionSource).not.toContain("TRPCError");
    expect(developerConnectionSource).not.toContain("../../trpc");
    expect(developerConnectionSource).not.toContain("../../domain/errors");
  });
});
