import { describe, expect, it } from "vitest";
import {
  SKILL_COUNT_MAX,
  SKILL_FILE_MAX_BYTES,
  collectSkillIndexCandidates,
  parseSkillFile,
  skillNameSchema,
} from "../index";

describe("@repo/skills-contract", () => {
  it("accepts standard skill names only", () => {
    expect(skillNameSchema.parse("code-review")).toBe("code-review");
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

  it("uses a narrow frontmatter compatibility fallback", () => {
    const result = parseSkillFile({
      contentSha: "abc123",
      contentSize: 112,
      path: "skills/github-triage/SKILL.md",
      sourceMarkdown:
        "---\nname: github-triage\ndescription: Use when labels include repo:area values.\n---\n\nBody.\n",
    });

    expect(result.entry.validationStatus).toBe("valid");
    expect(result.entry.diagnostics.map((d) => d.code)).toContain(
      "frontmatter_compatibility_fallback"
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

  it("aborts when canonical skill count exceeds the cap", () => {
    const entries = Array.from({ length: SKILL_COUNT_MAX + 1 }, (_, index) => ({
      mode: "100644",
      path: `skills/skill-${index}/SKILL.md`,
      sha: `sha-${index}`,
      size: 80,
      type: "blob" as const,
    }));

    const result = collectSkillIndexCandidates(entries);
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
});
