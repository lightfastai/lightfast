import { describe, expect, it } from "vitest";
import type { SkillName } from "../index";
import {
  collectSkillIndexCandidates,
  parseSkillFile,
  SKILL_COUNT_MAX,
  SKILL_FILE_MAX_BYTES,
  SKILL_RESOURCE_PATH_MAX,
  skillNameSchema,
} from "../index";

describe("@repo/skills-contract", () => {
  it("accepts standard skill names only", () => {
    const name: SkillName = skillNameSchema.parse("code-review");

    expect(name).toBe("code-review");
    expect(skillNameSchema.safeParse("Code Review").success).toBe(false);
    expect(skillNameSchema.safeParse("code_review").success).toBe(false);
    expect(skillNameSchema.safeParse("-code-review").success).toBe(false);
  });

  it("parses a valid standard SKILL.md", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 92,
      path: "skills/code-review/SKILL.md",
      sourceMarkdown:
        "---\nname: code-review\ndescription: Use when reviewing code.\n---\n\nReview the diff carefully.\n",
    });

    expect(result.entry).toMatchObject({
      slug: "code-review",
      name: "code-review",
      description: "Use when reviewing code.",
      validationStatus: "valid",
      bodyMarkdown: "Review the diff carefully.",
    });
    expect(result.entry.diagnostics).toEqual([]);
  });

  it("carries provided resources and non-standard resource count", () => {
    const resources = {
      assets: ["skills/code-review/assets/flow.png"],
      references: ["skills/code-review/references/checklist.md"],
      scripts: ["skills/code-review/scripts/check.sh"],
      truncated: false,
    };

    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 92,
      path: "skills/code-review/SKILL.md",
      resources,
      nonStandardResourceCount: 2,
      sourceMarkdown:
        "---\nname: code-review\ndescription: Use when reviewing code.\n---\n\nReview the diff carefully.\n",
    });

    expect(result.entry.resources).toEqual(resources);
    expect(result.entry.nonStandardResourceCount).toBe(2);
  });

  it("marks name mismatches invalid but visible", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 86,
      path: "skills/code-review/SKILL.md",
      sourceMarkdown:
        "---\nname: review-code\ndescription: Use when reviewing code.\n---\n\nBody.\n",
    });

    expect(result.entry.slug).toBe("code-review");
    expect(result.entry.validationStatus).toBe("invalid");
    expect(result.entry.diagnostics.map((d) => d.code)).toContain(
      "name_slug_mismatch"
    );
  });

  it("does not use compatibility fallback when YAML parsing succeeds", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 112,
      path: "skills/github-triage/SKILL.md",
      sourceMarkdown:
        "---\nname: github-triage\ndescription: Use when labels include repo:area values.\n---\n\nBody.\n",
    });

    expect(result.entry.validationStatus).toBe("valid");
    expect(result.entry.diagnostics.map((d) => d.code)).not.toContain(
      "frontmatter_compatibility_fallback"
    );
  });

  it("uses compatibility fallback only for parse errors with name and description scalars", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 113,
      path: "skills/github-triage/SKILL.md",
      sourceMarkdown:
        "---\nname: github-triage\ndescription: Use when labels include repo: area values.\n---\n\nBody.\n",
    });

    expect(result.entry.validationStatus).toBe("valid");
    expect(result.entry.diagnostics.map((d) => d.code)).toContain(
      "frontmatter_compatibility_fallback"
    );
  });

  it("rejects compatibility fallback when simple scalar frontmatter has extra keys", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 132,
      path: "skills/github-triage/SKILL.md",
      sourceMarkdown:
        "---\nname: github-triage\ndescription: Use when labels include repo: area values.\nlicense: Apache-2.0\n---\n\nBody.\n",
    });

    expect(result.entry.validationStatus).toBe("invalid");
    expect(result.entry.diagnostics.map((d) => d.code)).toContain(
      "frontmatter_invalid"
    );
  });

  it("separates resource inventory and non-standard files", () => {
    const result = collectSkillIndexCandidates([
      {
        mode: "100644",
        path: "skills/code-review/SKILL.md",
        sha: "skillsha",
        size: 80,
        type: "blob",
      },
      {
        mode: "100644",
        path: "skills/code-review/references/checklist.md",
        sha: "refsha",
        size: 12,
        type: "blob",
      },
      {
        mode: "100644",
        path: "skills/code-review/assets/flow.png",
        sha: "assetsha",
        size: 12,
        type: "blob",
      },
      {
        mode: "100644",
        path: "skills/code-review/prompts/extra.md",
        sha: "promptsha",
        size: 12,
        type: "blob",
      },
    ]);

    expect(result.canonicalSkillFiles).toHaveLength(1);
    expect(result.resourcesBySlug.get("code-review")).toEqual({
      assets: ["skills/code-review/assets/flow.png"],
      references: ["skills/code-review/references/checklist.md"],
      scripts: [],
      truncated: false,
    });
    expect(result.nonStandardResourceCountBySlug.get("code-review")).toBe(1);
  });

  it("keeps the lexicographically first resources when inventory exceeds the cap", () => {
    const resourceEntries = Array.from(
      { length: SKILL_RESOURCE_PATH_MAX + 5 },
      (_, index) => ({
        mode: "100644",
        path: `skills/code-review/references/item-${String(
          SKILL_RESOURCE_PATH_MAX + 4 - index
        ).padStart(3, "0")}.md`,
        sha: `refsha-${index}`,
        size: 12,
        type: "blob" as const,
      })
    );

    const result = collectSkillIndexCandidates([
      {
        mode: "100644",
        path: "skills/code-review/SKILL.md",
        sha: "skillsha",
        size: 80,
        type: "blob",
      },
      ...resourceEntries,
    ]);

    const references =
      result.resourcesBySlug.get("code-review")?.references ?? [];
    const expected = Array.from(
      { length: SKILL_RESOURCE_PATH_MAX },
      (_, index) =>
        `skills/code-review/references/item-${String(index).padStart(3, "0")}.md`
    );

    expect(references).toEqual(expected);
    expect(result.resourcesBySlug.get("code-review")?.truncated).toBe(true);
  });

  it("aborts when canonical skill count exceeds the cap", () => {
    const entries = Array.from({ length: SKILL_COUNT_MAX + 1 }, (_, index) => ({
      mode: "100644",
      path: `skills/skill-${index}/SKILL.md`,
      sha: `sha-${index}`,
      size: 80,
      type: "blob" as const,
    }));

    const result = collectSkillIndexCandidates(entries);
    expect(result.canonicalSkillFiles).toHaveLength(SKILL_COUNT_MAX);
    expect(result.fatalDiagnostics.map((d) => d.code)).toContain(
      "too_many_skills"
    );
  });

  it("marks oversized files invalid without source markdown", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: SKILL_FILE_MAX_BYTES + 1,
      path: "skills/code-review/SKILL.md",
      sourceMarkdown: null,
    });

    expect(result.entry.validationStatus).toBe("invalid");
    expect(result.entry.sourceMarkdown).toBeNull();
    expect(result.entry.bodyMarkdown).toBeNull();
    expect(result.entry.diagnostics.map((d) => d.code)).toContain(
      "file_too_large"
    );
  });

  it("keeps overlong frontmatter from overflowing persisted index columns", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 130_000,
      path: "skills/code-review/SKILL.md",
      sourceMarkdown: [
        "---",
        `name: ${"x".repeat(80)}`,
        `description: ${"d".repeat(1100)}`,
        `license: ${"l".repeat(300)}`,
        `compatibility: ${"c".repeat(600)}`,
        `allowed-tools: ${"t".repeat(2100)}`,
        "---",
        "Body.",
      ].join("\n"),
    });

    expect(result.entry.validationStatus).toBe("invalid");
    expect(result.entry.name).toBeNull();
    expect(result.entry.description).toBeNull();
    expect(result.entry.license).toBeNull();
    expect(result.entry.compatibility).toBeNull();
    expect(result.entry.allowedTools).toBeNull();
    expect(result.entry.sourceMarkdown).not.toBeNull();
    expect(result.entry.diagnostics.map((d) => d.code)).toEqual(
      expect.arrayContaining([
        "name_invalid",
        "description_too_long",
        "license_invalid",
        "compatibility_invalid",
        "allowed-tools_invalid",
      ])
    );
  });
});
