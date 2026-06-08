import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTeamIdempotencyKey,
  normalizeTeamSlug,
} from "~/account/team-name";

describe("team name helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("normalizes team names to Clerk-compatible slugs", () => {
    expect(normalizeTeamSlug(" Acme Inc! ")).toBe("acmeinc");
    expect(normalizeTeamSlug("---Acme---Inc")).toBe("acme---inc");
    expect(normalizeTeamSlug("Team_123")).toBe("team123");
  });

  it("prefers crypto UUIDs for idempotency keys", () => {
    const randomUUID = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValue("00000000-0000-4000-8000-000000000000");

    expect(createTeamIdempotencyKey()).toBe(
      "00000000-0000-4000-8000-000000000000"
    );
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it("falls back to secure random values for idempotency keys", () => {
    const mathRandom = vi.spyOn(Math, "random");
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab);
        return bytes;
      },
    });

    expect(createTeamIdempotencyKey()).toBe(`org-${"ab".repeat(16)}`);
    expect(mathRandom).not.toHaveBeenCalled();
  });
});
