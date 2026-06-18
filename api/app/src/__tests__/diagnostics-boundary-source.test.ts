import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

function source(path: string) {
  return readFileSync(resolve(apiRoot, path), "utf8");
}

describe("diagnostics boundary", () => {
  it("keeps diagnostic payloads transport-neutral", () => {
    const diagnosticsSource = source("diagnostics.ts");

    expect(diagnosticsSource).not.toContain("@trpc/server");
    expect(diagnosticsSource).not.toContain("TRPCError");
    expect(diagnosticsSource).not.toContain("TRPC_ERROR_CODE_KEY");
    expect(diagnosticsSource).not.toContain("trpcCode");
  });

  it("keeps tRPC error construction inside the tRPC adapter", () => {
    const trpcSource = source("trpc.ts");
    const githubGateSource = source("services/github/user-account/gate.ts");

    expect(trpcSource).toContain("@trpc/server");
    expect(trpcSource).toContain("createDiagnosticCause");
    expect(trpcSource).toContain("new TRPCError");
    expect(githubGateSource).not.toContain("../../../diagnostics");
    expect(githubGateSource).not.toContain("throwDiagnostic");
  });
});
