import { describe, expect, it } from "vitest";
import {
  IDENTITY_CONTEXT_SURFACES,
  IDENTITY_FILE_KINDS,
  IDENTITY_FILE_NAMES,
  IDENTITY_INDEX_MAX_CHARS_PER_FILE,
  IDENTITY_INDEX_REFRESH_STATUSES,
  IDENTITY_WATCHED_PATH_GLOBS,
  type IdentityContextSurface,
  type IdentityFileKind,
  identityContextProvenanceSchema,
  identityContextSurfaceSchema,
  identityFileKindSchema,
  identityFileStatusSchema,
  identityIndexRefreshStatusSchema,
  SIGNAL_IDENTITY_CONTEXT_MAX_CHARS,
  signalClassificationMetadataSchema,
} from "../index";

describe("@repo/identity-contract", () => {
  it("defines root identity files and watched .lightfast paths", () => {
    expect(IDENTITY_FILE_NAMES).toEqual({
      identity: "IDENTITY.md",
      soul: "SOUL.md",
    });
    expect(IDENTITY_FILE_KINDS).toEqual(["identity", "soul"]);
    expect(IDENTITY_WATCHED_PATH_GLOBS).toEqual([
      "skills/**",
      "IDENTITY.md",
      "SOUL.md",
    ]);
  });

  it("defines indexing and signal budgets", () => {
    expect(IDENTITY_INDEX_MAX_CHARS_PER_FILE).toBe(20_000);
    expect(SIGNAL_IDENTITY_CONTEXT_MAX_CHARS).toBe(4000);
  });

  it("validates identity file kinds, statuses, and runtime surfaces", () => {
    const kind: IdentityFileKind = identityFileKindSchema.parse("identity");
    const surface: IdentityContextSurface =
      identityContextSurfaceSchema.parse("signal");

    expect(kind).toBe("identity");
    expect(surface).toBe("signal");
    expect(IDENTITY_CONTEXT_SURFACES).toEqual(["signal", "chat", "agent"]);
    expect(identityFileKindSchema.safeParse("memory").success).toBe(false);
    expect(identityFileStatusSchema.safeParse("present").success).toBe(true);
    expect(identityFileStatusSchema.safeParse("invalid").success).toBe(false);
    expect(identityContextSurfaceSchema.safeParse("people").success).toBe(
      false
    );
  });

  it("validates identity index refresh lifecycle statuses", () => {
    expect(IDENTITY_INDEX_REFRESH_STATUSES).toEqual([
      "never",
      "fresh",
      "stale",
      "refreshing",
      "failed",
    ]);
    expect(identityIndexRefreshStatusSchema.safeParse("fresh").success).toBe(
      true
    );
    expect(identityIndexRefreshStatusSchema.safeParse("present").success).toBe(
      false
    );
  });

  it("validates workflow-owned signal classification identity metadata", () => {
    const metadata = signalClassificationMetadataSchema.parse({
      organizationIdentity: {
        surface: "signal",
        includedFiles: [
          {
            kind: "identity",
            path: "IDENTITY.md",
            status: "present",
            contentHash: "sha256:abc",
            commitSha: "commit-sha",
          },
        ],
        diagnostics: ["identity context included"],
        systemSectionHash: "sha256:def",
      },
    });

    expect(metadata.organizationIdentity?.includedFiles).toHaveLength(1);
    expect(
      identityContextProvenanceSchema.safeParse(metadata.organizationIdentity)
        .success
    ).toBe(true);
    expect(
      signalClassificationMetadataSchema.safeParse({
        organizationIdentity: {
          surface: "people",
          includedFiles: [],
          diagnostics: [],
          systemSectionHash: null,
        },
      }).success
    ).toBe(false);
  });
});
