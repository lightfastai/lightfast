import { parse as parseYaml } from "yaml";

import { SkillFrontmatterSchema } from "./schema";
import {
  type DotLightfastConfig,
  DotLightfastParseError,
  type Fetcher,
  type SkillManifest,
} from "./types";

const MAX_SPEC_BYTES = 32_000;
const MAX_SKILLS = 50;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function extractFrontmatter(source: string): Record<string, unknown> | null {
  const match = FRONTMATTER_RE.exec(source);
  if (!match?.[1]) {
    return null;
  }
  try {
    const parsed = parseYaml(match[1]);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function parseDotLightfast(
  fetcher: Fetcher
): Promise<DotLightfastConfig> {
  const specResult = await fetcher("SPEC.md");
  let spec: string | null = null;
  if (specResult.type === "file") {
    spec =
      specResult.content.length > MAX_SPEC_BYTES
        ? specResult.content.slice(0, MAX_SPEC_BYTES)
        : specResult.content;
  } else if (specResult.type !== "missing") {
    throw new DotLightfastParseError(
      "SPEC.md path resolved to a directory",
      "SPEC.md"
    );
  }

  const skillsRoot = await fetcher("skills");
  const skills: SkillManifest[] = [];
  if (skillsRoot.type === "dir") {
    const dirEntries = skillsRoot.entries
      .filter((e) => e.type === "dir")
      .slice(0, MAX_SKILLS);

    for (const entry of dirEntries) {
      const skill = await loadSkill(fetcher, entry.name);
      if (skill) {
        skills.push(skill);
      }
    }
  }

  return { spec, skills };
}

async function loadSkill(
  fetcher: Fetcher,
  dirName: string
): Promise<SkillManifest | null> {
  const skillPath = `skills/${dirName}/SKILL.md`;
  const skillFile = await fetcher(skillPath);
  if (skillFile.type !== "file") {
    return null;
  }

  const raw = extractFrontmatter(skillFile.content);
  if (!raw) {
    return null;
  }

  const parsed = SkillFrontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const commandProbe = await fetcher(
    `skills/${dirName}/command/${parsed.data.name}.md`
  );

  return {
    name: parsed.data.name,
    description: parsed.data.description,
    hasCommand: commandProbe.type === "file",
    path: `skills/${dirName}/`,
  };
}
