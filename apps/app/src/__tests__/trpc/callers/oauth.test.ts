import { describe, expect, it, vi } from "vitest";

const createTRPCContext = vi.fn(async ({ headers }: { headers: Headers }) => ({
  headers,
}));
const createCaller = vi.fn((ctx: unknown) => ({ ctx }));

vi.mock("@api/app", () => ({
  appRouter: {},
  createCallerFactory: () => createCaller,
  createTRPCContext,
}));

describe("createNativeOAuthFacadeCaller", () => {
  it("adapts native OAuth facade requests into tRPC context", async () => {
    const { createNativeOAuthFacadeCaller } = await import(
      "~/trpc/callers/oauth"
    );

    await createNativeOAuthFacadeCaller({
      headers: new Headers({ authorization: "Bearer access" }),
      source: "desktop",
    });

    const headers = createTRPCContext.mock.calls[0]?.[0].headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer access");
    expect(headers.get("x-lightfast-native-client")).toBe("desktop");
    expect(headers.get("x-trpc-source")).toBe("desktop");
  });
});
