import { describe, expect, it, vi } from "vitest";
import { CliAuthError, formatCliError } from "../auth/errors";
import { createProgram } from "../program";

function createOutput() {
  let output = "";
  return {
    stream: {
      write(chunk: string | Uint8Array) {
        output += String(chunk);
        return true;
      },
    } as NodeJS.WritableStream,
    read: () => output,
  };
}

describe("CLI program", () => {
  it("runs login without local org selection", async () => {
    const login = vi.fn(async () => ({
      appUrl: "https://app.lightfast.test",
      client: "cli" as const,
      oauth: {
        clientId: "cli_client_test",
        issuer: "https://clerk.example.com",
      },
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      schemaVersion: 2 as const,
      tokens: {
        accessToken: "access",
        expiresAt: 4_102_444_800_000,
        refreshToken: "refresh",
        tokenType: "Bearer" as const,
      },
      user: { email: "dev@example.com", id: "user_1" },
    }));
    const output = createOutput();

    await createProgram({ login, stdout: output.stream }).parseAsync([
      "node",
      "lightfast",
      "login",
    ]);

    expect(login).toHaveBeenCalledWith({});
    expect(output.read()).toContain("Logged in as dev@example.com for Acme");
  });

  it("prints the current session", async () => {
    const output = createOutput();
    const store = {
      clear: vi.fn(),
      get: vi.fn(async () => ({
        appUrl: "https://app.lightfast.test",
        client: "cli" as const,
        oauth: {
          clientId: "cli_client_test",
          issuer: "https://clerk.example.com",
        },
        organization: { id: "org_1", name: "Acme", slug: "acme" },
        schemaVersion: 2 as const,
        tokens: {
          accessToken: "access",
          expiresAt: 4_102_444_800_000,
          refreshToken: "refresh",
          tokenType: "Bearer" as const,
        },
        user: { email: "dev@example.com", id: "user_1" },
      })),
      set: vi.fn(),
    };

    await createProgram({ stdout: output.stream, store }).parseAsync([
      "node",
      "lightfast",
      "whoami",
    ]);

    expect(output.read()).toContain("dev@example.com");
    expect(output.read()).toContain("Acme");
  });

  it("clears the stored session on logout", async () => {
    const output = createOutput();
    const store = { clear: vi.fn(), get: vi.fn(), set: vi.fn() };

    await createProgram({ stdout: output.stream, store }).parseAsync([
      "node",
      "lightfast",
      "logout",
    ]);

    expect(store.clear).toHaveBeenCalledOnce();
    expect(output.read()).toContain("Logged out");
  });

  it("formats command failures as concise CLI errors", () => {
    expect(
      formatCliError(
        new CliAuthError("NOT_LOGGED_IN", "Run `lightfast login`.")
      )
    ).toBe("Run `lightfast login`.");
  });
});
