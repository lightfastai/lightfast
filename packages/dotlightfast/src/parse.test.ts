import { describe, expect, it, vi } from "vitest";

import { parseDotLightfast } from "./parse";
import {
  DotLightfastParseError,
  type Fetcher,
  type FetcherResult,
} from "./types";

const makeFetcher =
  (map: Record<string, FetcherResult>): Fetcher =>
  async (path) =>
    map[path] ?? { type: "missing" };

const skillFile = (frontmatter: string, body = ""): FetcherResult => ({
  type: "file",
  content: `---\n${frontmatter}\n---\n${body}`,
});

const dir = (
  entries: { name: string; type: "file" | "dir" }[] = []
): FetcherResult => ({ type: "dir", entries });

describe("parseDotLightfast — happy path / shape", () => {
  const buildHappyMap = (): Record<string, FetcherResult> => ({
    "SPEC.md": { type: "file", content: "# Hello" },
    skills: dir([
      { name: "alpha", type: "dir" },
      { name: "beta", type: "dir" },
    ]),
    "skills/alpha/SKILL.md": skillFile(
      "name: alpha\ndescription: The alpha skill"
    ),
    "skills/alpha/command/alpha.md": { type: "file", content: "" },
    "skills/beta/SKILL.md": skillFile(
      "name: beta\ndescription: The beta skill"
    ),
  });

  it("returns { spec, skills[] } with both skills parsed", async () => {
    const result = await parseDotLightfast(makeFetcher(buildHappyMap()));

    expect(result.spec).toBe("# Hello");
    expect(result.skills).toHaveLength(2);
    expect(result.skills[0]).toMatchObject({
      name: "alpha",
      description: "The alpha skill",
      hasCommand: true,
    });
    expect(result.skills[1]).toMatchObject({
      name: "beta",
      description: "The beta skill",
      hasCommand: false,
    });
    expect(Object.keys(result).sort()).toEqual(["skills", "spec"]);
  });

  it("skill path has no .lightfast/ prefix (regression guard)", async () => {
    const fetcher = vi.fn(makeFetcher(buildHappyMap()));
    const result = await parseDotLightfast(fetcher);

    for (const skill of result.skills) {
      expect(skill.path.startsWith("skills/")).toBe(true);
      expect(skill.path.includes(".lightfast")).toBe(false);
    }

    const calledPaths = fetcher.mock.calls.map(([p]) => p);
    expect(calledPaths).toContain("SPEC.md");
    expect(calledPaths).toContain("skills");
    for (const p of calledPaths) {
      expect(p.startsWith(".lightfast/")).toBe(false);
    }
  });

  it("invokes fetcher with the expected paths", async () => {
    const fetcher = vi.fn(makeFetcher(buildHappyMap()));
    await parseDotLightfast(fetcher);

    const calledPaths = new Set(fetcher.mock.calls.map(([p]) => p));
    expect(calledPaths).toEqual(
      new Set([
        "SPEC.md",
        "skills",
        "skills/alpha/SKILL.md",
        "skills/alpha/command/alpha.md",
        "skills/beta/SKILL.md",
        "skills/beta/command/beta.md",
      ])
    );
  });
});

describe("parseDotLightfast — missing-config branches", () => {
  it("returns { spec: null, skills: [] } when neither SPEC.md nor skills exist", async () => {
    const result = await parseDotLightfast(makeFetcher({}));
    expect(result.spec).toBeNull();
    expect(result.skills).toEqual([]);
  });

  it("returns { spec, skills: [] } when SPEC exists but skills dir is missing", async () => {
    const result = await parseDotLightfast(
      makeFetcher({
        "SPEC.md": { type: "file", content: "# Spec" },
      })
    );
    expect(result.spec).not.toBeNull();
    expect(result.skills).toEqual([]);
  });
});

describe("parseDotLightfast — SPEC edge cases", () => {
  it("throws DotLightfastParseError with path='SPEC.md' when SPEC.md resolves to a directory", async () => {
    const fetcher = makeFetcher({ "SPEC.md": dir() });
    await expect(parseDotLightfast(fetcher)).rejects.toThrowError(
      DotLightfastParseError
    );
    await expect(parseDotLightfast(fetcher)).rejects.toMatchObject({
      path: "SPEC.md",
    });
  });

  it("truncates SPEC longer than MAX_SPEC_BYTES (32_000) to exactly 32_000 chars", async () => {
    const input = "x".repeat(40_000);
    const result = await parseDotLightfast(
      makeFetcher({ "SPEC.md": { type: "file", content: input } })
    );
    expect(result.spec).not.toBeNull();
    expect(result.spec!.length).toBe(32_000);
    expect(result.spec).toBe(input.slice(0, 32_000));
  });

  it("does not truncate SPEC at exactly MAX_SPEC_BYTES", async () => {
    const input = "y".repeat(32_000);
    const result = await parseDotLightfast(
      makeFetcher({ "SPEC.md": { type: "file", content: input } })
    );
    expect(result.spec).toBe(input);
  });
});

describe("parseDotLightfast — skills filtering and caps", () => {
  it("silently skips file entries inside the skills directory", async () => {
    const result = await parseDotLightfast(
      makeFetcher({
        skills: dir([
          { name: "README.md", type: "file" },
          { name: "alpha", type: "dir" },
        ]),
        "skills/alpha/SKILL.md": skillFile(
          "name: alpha\ndescription: alpha skill"
        ),
      })
    );
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.name).toBe("alpha");
  });

  it("caps at MAX_SKILLS (50) even when more skill dirs are present", async () => {
    const entries: { name: string; type: "file" | "dir" }[] = [];
    const skillFiles: Record<string, FetcherResult> = {};
    for (let i = 0; i <= 50; i++) {
      const name = `skill-${i.toString().padStart(2, "0")}`;
      entries.push({ name, type: "dir" });
      skillFiles[`skills/${name}/SKILL.md`] = skillFile(
        `name: ${name}\ndescription: skill ${i}`
      );
    }

    const result = await parseDotLightfast(
      makeFetcher({ skills: dir(entries), ...skillFiles })
    );
    expect(result.skills).toHaveLength(50);
    expect(result.skills[49]?.name).toBe("skill-49");
    expect(result.skills.find((s) => s.name === "skill-50")).toBeUndefined();
  });

  it("silently skips skill dirs missing SKILL.md", async () => {
    const result = await parseDotLightfast(
      makeFetcher({
        skills: dir([
          { name: "alpha", type: "dir" },
          { name: "bravo", type: "dir" },
        ]),
        "skills/alpha/SKILL.md": skillFile(
          "name: alpha\ndescription: alpha skill"
        ),
      })
    );
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.name).toBe("alpha");
  });
});

describe("parseDotLightfast — frontmatter resilience", () => {
  const expectSkipped = async (skillContent: string) => {
    const result = await parseDotLightfast(
      makeFetcher({
        skills: dir([{ name: "broken", type: "dir" }]),
        "skills/broken/SKILL.md": { type: "file", content: skillContent },
      })
    );
    expect(result.skills).toEqual([]);
  };

  it("skips skill with no frontmatter block", async () => {
    await expectSkipped("plain markdown body, no fences here");
  });

  it("skips skill with malformed YAML inside frontmatter", async () => {
    await expectSkipped("---\nname: broken\n  : : :\n---\n");
  });

  it("skips skill whose frontmatter parses to a YAML array", async () => {
    await expectSkipped("---\n- one\n- two\n---\n");
  });

  it("skips skill whose frontmatter fails SkillFrontmatterSchema", async () => {
    await expectSkipped("---\nname: Broken Name\ndescription: nope\n---\n");
  });

  it("parses frontmatter with CRLF line endings", async () => {
    const content =
      "---\r\nname: alpha\r\ndescription: alpha skill\r\n---\r\nbody\r\n";
    const result = await parseDotLightfast(
      makeFetcher({
        skills: dir([{ name: "alpha", type: "dir" }]),
        "skills/alpha/SKILL.md": { type: "file", content },
      })
    );
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]).toMatchObject({
      name: "alpha",
      description: "alpha skill",
    });
  });
});

describe("parseDotLightfast — command probe branching", () => {
  it.each<[string, FetcherResult, boolean]>([
    ["file", { type: "file", content: "" }, true],
    ["dir", dir(), false],
    ["missing", { type: "missing" }, false],
  ])("hasCommand is true only when probe resolves to a file (probe=%s)", async (_label, commandResult, expected) => {
    const result = await parseDotLightfast(
      makeFetcher({
        skills: dir([{ name: "alpha", type: "dir" }]),
        "skills/alpha/SKILL.md": skillFile(
          "name: alpha\ndescription: alpha skill"
        ),
        "skills/alpha/command/alpha.md": commandResult,
      })
    );
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.hasCommand).toBe(expected);
  });

  it("probes skills/<dirName>/command/<frontmatter.name>.md when dirName differs from name", async () => {
    const fetcher = vi.fn(
      makeFetcher({
        skills: dir([{ name: "alpha-v2", type: "dir" }]),
        "skills/alpha-v2/SKILL.md": skillFile(
          "name: alpha\ndescription: alpha skill"
        ),
        "skills/alpha-v2/command/alpha.md": { type: "file", content: "" },
      })
    );

    const result = await parseDotLightfast(fetcher);

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.hasCommand).toBe(true);

    const calledPaths = fetcher.mock.calls.map(([p]) => p);
    expect(calledPaths).toContain("skills/alpha-v2/command/alpha.md");
    expect(calledPaths).not.toContain("skills/alpha/command/alpha.md");
    expect(calledPaths).not.toContain("skills/alpha-v2/command/alpha-v2.md");
  });
});
