import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("service domain errors", () => {
  it("keeps service errors framework-neutral", () => {
    const connectorServiceSource = source("services/connectors/index.ts");
    expect(connectorServiceSource).not.toContain("@trpc/server");
    expect(connectorServiceSource).not.toContain("TRPCError");
  });
});
