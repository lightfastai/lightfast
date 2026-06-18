import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const proxySource = readFileSync(
  fileURLToPath(new URL("../proxy.ts", import.meta.url)),
  "utf8"
);

describe("www proxy source", () => {
  it("does not keep the retired tRPC route matcher alive", () => {
    expect(proxySource).toContain("api");
    expect(proxySource).not.toContain("trpc");
  });
});
