import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const createTRPCContext = vi.fn(
  async ({ headers }: { headers: Headers }) =>
    ({
      auth: {
        identity: { type: "pending" as const, userId: "user_test" },
      },
      db: {},
      headers,
    }) as const
);

vi.mock("@api/app", () => ({
  createTRPCContext,
}));

const { createTanStackTRPCContext } = await import("../trpc/context");

const appRoot = resolve(import.meta.dirname, "../..");

describe("app tRPC context bridge", () => {
  it("delegates context creation to the shared app API context", async () => {
    const headers = new Headers({ cookie: "__session=test-session" });

    const context = await createTanStackTRPCContext({ headers });

    expect(createTRPCContext).toHaveBeenCalledWith({ headers });
    expect(context.auth.identity).toEqual({
      type: "pending",
      userId: "user_test",
    });
  });

  it("uses the TanStack Clerk server compatibility layer", () => {
    const source = readFileSync(
      resolve(appRoot, "src/compat/clerk-server.ts"),
      "utf8"
    );

    expect(source).toContain("@clerk/tanstack-react-start/server");
    expect(source).not.toContain("not wired for app yet");
    expect(source).not.toContain('type: "unauthenticated"');
  });
});
