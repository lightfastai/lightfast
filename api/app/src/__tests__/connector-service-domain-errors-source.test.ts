import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("connector service domain errors", () => {
  it("keeps connector dispatch and config errors framework-neutral", () => {
    for (const file of [
      "services/connectors/index.ts",
      "services/connectors/config.ts",
      "services/user-connectors/index.ts",
    ]) {
      const fileSource = source(file);

      expect(fileSource, file).toContain("../../domain/errors");
      expect(fileSource, file).not.toContain("@trpc/server");
      expect(fileSource, file).not.toContain("TRPCError");
    }
  });
});
