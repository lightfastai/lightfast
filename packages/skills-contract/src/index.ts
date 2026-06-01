import { parseDocument, YAMLMap } from "yaml";
import { z } from "zod";

export const SKILL_COUNT_MAX = 200;
export const SKILL_FILE_MAX_BYTES = 128 * 1024;
export const SKILL_RESOURCE_PATH_MAX = 100;

export const skillIndexRefreshStatusSchema = z.enum([
  "never",
  "fresh",
  "stale",
  "refreshing",
  "failed",
]);
export type SkillIndexRefreshStatus = z.infer<
  typeof skillIndexRefreshStatusSchema
>;

export const skillNameSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
  .refine((name) => !name.endsWith("-") && !name.includes("--"));
export type SkillName = z.infer<typeof skillNameSchema>;

export const skillValidationStatusSchema = z.enum(["valid", "invalid"]);
export type SkillValidationStatus = z.infer<
  typeof skillValidationStatusSchema
>;

export const skillDiagnosticSchema = z.object({
  severity: z.enum(["error", "warning"]),
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  details: z.unknown().optional(),
});
export type SkillDiagnostic = z.infer<typeof skillDiagnosticSchema>;

export const skillResourcesSchema = z.object({
  assets: z.array(z.string()),
  references: z.array(z.string()),
  scripts: z.array(z.string()),
  truncated: z.boolean(),
});
export type SkillResources = z.infer<typeof skillResourcesSchema>;

export interface SkillTreeEntry {
  mode: string;
  path: string;
  sha: string;
  size: number;
  type: "blob" | "tree" | string;
}

export interface ParsedSkillEntry {
  slug: string;
  path: string;
  contentSha: string;
  contentSize: number;
  sourceMarkdown: string | null;
  bodyMarkdown: string | null;
  name: string | null;
  description: string | null;
  license: string | null;
  compatibility: string | null;
  allowedTools: string | null;
  metadata: Record<string, string | number | boolean | null>;
  resources: SkillResources;
  validationStatus: SkillValidationStatus;
  diagnostics: SkillDiagnostic[];
}

export interface ParseSkillFileInput {
  contentSha: string;
  contentSize: number;
  path: string;
  sourceMarkdown: string | null;
}

export interface ParseSkillFileResult {
  entry: ParsedSkillEntry;
}

export interface SkillIndexCandidateCollection {
  canonicalSkillFiles: SkillTreeEntry[];
  resourcesBySlug: Map<string, SkillResources>;
  nonStandardResourceCountBySlug: Map<string, number>;
  diagnostics: SkillDiagnostic[];
  fatalDiagnostics: SkillDiagnostic[];
}

type FrontmatterValue = string | number | boolean | null | FrontmatterValue[] | {
  [key: string]: FrontmatterValue;
};

const emptyResources = (): SkillResources => ({
  assets: [],
  references: [],
  scripts: [],
  truncated: false,
});

const createBaseEntry = (input: ParseSkillFileInput): ParsedSkillEntry => ({
  slug: getSlugFromSkillPath(input.path),
  path: input.path,
  contentSha: input.contentSha,
  contentSize: input.contentSize,
  sourceMarkdown: input.sourceMarkdown,
  bodyMarkdown: null,
  name: null,
  description: null,
  license: null,
  compatibility: null,
  allowedTools: null,
  metadata: {},
  resources: emptyResources(),
  validationStatus: "valid",
  diagnostics: [],
});

export function parseSkillFile(input: ParseSkillFileInput): ParseSkillFileResult {
  const entry = createBaseEntry(input);
  const diagnostics = entry.diagnostics;

  if (
    input.contentSize > SKILL_FILE_MAX_BYTES ||
    input.sourceMarkdown === null
  ) {
    diagnostics.push({
      severity: "error",
      code: "file_too_large",
      message: "Skill file exceeds the maximum allowed size.",
      path: input.path,
    });
    entry.sourceMarkdown = null;
    entry.bodyMarkdown = null;
    entry.validationStatus = "invalid";
    return { entry };
  }

  const withoutBom = input.sourceMarkdown.startsWith("\uFEFF")
    ? input.sourceMarkdown.slice(1)
    : input.sourceMarkdown;

  if (!withoutBom.startsWith("---\n") && !withoutBom.startsWith("---\r\n")) {
    diagnostics.push({
      severity: "error",
      code: "frontmatter_missing",
      message: "Skill file must begin with YAML frontmatter.",
      path: input.path,
    });
    return invalid(entry);
  }

  const frontmatter = splitFrontmatter(withoutBom);
  if (frontmatter === null) {
    diagnostics.push({
      severity: "error",
      code: "frontmatter_invalid",
      message: "Skill file frontmatter is not closed.",
      path: input.path,
    });
    return invalid(entry);
  }

  const parsed = parseFrontmatter(frontmatter.markdown, input.path);
  diagnostics.push(...parsed.diagnostics);

  if (parsed.data === null) {
    return invalid(entry);
  }

  applyFrontmatter(entry, parsed.data);
  entry.bodyMarkdown = frontmatter.body.trim();

  validateRequiredFields(entry);
  validateOptionalFields(entry, parsed.data);

  if (entry.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    entry.validationStatus = "invalid";
  }

  return { entry };
}

export function collectSkillIndexCandidates(
  entries: SkillTreeEntry[]
): SkillIndexCandidateCollection {
  let canonicalSkillFiles: SkillTreeEntry[] = [];
  const resourcesBySlug = new Map<string, SkillResources>();
  const nonStandardResourceCountBySlug = new Map<string, number>();
  const diagnostics: SkillDiagnostic[] = [];
  const fatalDiagnostics: SkillDiagnostic[] = [];
  const invalidDirectories = new Set<string>();

  for (const entry of entries) {
    if (entry.type !== "blob") {
      continue;
    }

    const parts = entry.path.split("/");
    if (parts[0] !== "skills" || parts.length < 3) {
      continue;
    }

    const slug = parts[1];
    if (!slug || !isValidSkillName(slug)) {
      if (slug) {
        invalidDirectories.add(slug);
      }
      continue;
    }

    if (isCanonicalSkillPath(entry.path, slug)) {
      canonicalSkillFiles.push(entry);
      ensureResources(resourcesBySlug, slug);
      continue;
    }

    const resourceKind = parts[2];
    if (isStandardResourceKind(resourceKind) && parts.length > 3) {
      addResourcePath(resourcesBySlug, slug, resourceKind, entry.path);
      continue;
    }

    nonStandardResourceCountBySlug.set(
      slug,
      (nonStandardResourceCountBySlug.get(slug) ?? 0) + 1
    );
  }

  canonicalSkillFiles.sort((a, b) => a.path.localeCompare(b.path));
  sortResources(resourcesBySlug);

  if (invalidDirectories.size > 0) {
    diagnostics.push({
      severity: "warning",
      code: "ignored_invalid_skill_directories",
      message: "Ignored skill directories with invalid slugs.",
      details: { slugs: [...invalidDirectories].sort() },
    });
  }

  const canonicalSkillFileCount = canonicalSkillFiles.length;
  if (canonicalSkillFileCount > SKILL_COUNT_MAX) {
    fatalDiagnostics.push({
      severity: "error",
      code: "too_many_skills",
      message: "Canonical skill count exceeds the maximum allowed size.",
      details: {
        count: canonicalSkillFileCount,
        max: SKILL_COUNT_MAX,
      },
    });
    canonicalSkillFiles = canonicalSkillFiles.slice(0, SKILL_COUNT_MAX);
  }

  return {
    canonicalSkillFiles,
    resourcesBySlug,
    nonStandardResourceCountBySlug,
    diagnostics,
    fatalDiagnostics,
  };
}

function invalid(entry: ParsedSkillEntry): ParseSkillFileResult {
  entry.validationStatus = "invalid";
  return { entry };
}

function getSlugFromSkillPath(path: string): string {
  const match = /^skills\/([^/]+)\/SKILL\.md$/.exec(path);
  return match?.[1] ?? "";
}

function isValidSkillName(value: string): boolean {
  return skillNameSchema.safeParse(value).success;
}

function splitFrontmatter(
  markdown: string
): { markdown: string; body: string } | null {
  const firstLineEnd = markdown.startsWith("---\r\n") ? 5 : 4;
  const rest = markdown.slice(firstLineEnd);
  const closingMatch = /(?:^|\r?\n)---(?:\r?\n|$)/.exec(rest);
  if (closingMatch === null || closingMatch.index < 0) {
    return null;
  }

  const closeStart = closingMatch.index;
  const closeEnd = closeStart + closingMatch[0].length;
  const frontmatter = rest.slice(
    0,
    closingMatch[0].startsWith("\n") || closingMatch[0].startsWith("\r\n")
      ? closeStart + closingMatch[0].match(/^\r?\n/)![0].length
      : closeStart
  );
  const normalizedFrontmatter = frontmatter.replace(/\r?\n$/, "");

  return {
    markdown: normalizedFrontmatter,
    body: rest.slice(closeEnd),
  };
}

function parseFrontmatter(
  markdown: string,
  path: string
): { data: Record<string, FrontmatterValue> | null; diagnostics: SkillDiagnostic[] } {
  const diagnostics: SkillDiagnostic[] = [];
  const document = parseDocument(markdown);

  if (document.errors.length === 0 && document.contents instanceof YAMLMap) {
    const data = document.toJSON() as unknown;
    if (isRecord(data)) {
      return { data: data as Record<string, FrontmatterValue>, diagnostics };
    }
  }

  if (document.errors.length > 0) {
    const fallback = parseSimpleScalarFrontmatter(markdown);
    if (fallback !== null) {
      diagnostics.push({
        severity: "warning",
        code: "frontmatter_compatibility_fallback",
        message: "Used compatibility parsing for simple scalar frontmatter.",
        path,
      });
      return { data: fallback, diagnostics };
    }
  }

  diagnostics.push({
    severity: "error",
    code: "frontmatter_invalid",
    message: "Skill file frontmatter must be a YAML mapping.",
    path,
  });
  return { data: null, diagnostics };
}

function parseSimpleScalarFrontmatter(
  markdown: string
): Record<string, string> | null {
  const data: Record<string, string> = {};
  for (const line of markdown.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match === null) {
      return null;
    }
    const key = match[1]!;
    if (key !== "name" && key !== "description") {
      return null;
    }
    const value = match[2]!;
    if (/^\s*[\[{\]&*!|>]/.test(value)) {
      return null;
    }
    data[key] = value;
  }
  return data;
}

function applyFrontmatter(
  entry: ParsedSkillEntry,
  data: Record<string, FrontmatterValue>
): void {
  entry.name = typeof data.name === "string" ? data.name : null;
  entry.description =
    typeof data.description === "string" ? data.description : null;
  entry.license = typeof data.license === "string" ? data.license : null;
  entry.compatibility =
    typeof data.compatibility === "string" ? data.compatibility : null;
  entry.allowedTools =
    typeof data["allowed-tools"] === "string" ? data["allowed-tools"] : null;
}

function validateRequiredFields(entry: ParsedSkillEntry): void {
  if (entry.name === null || entry.name.trim() === "") {
    entry.diagnostics.push({
      severity: "error",
      code: "name_missing",
      message: "Skill frontmatter must include a non-empty name.",
      path: entry.path,
    });
  } else if (!isValidSkillName(entry.name)) {
    entry.diagnostics.push({
      severity: "error",
      code: "name_invalid",
      message: "Skill name must be a standard slug.",
      path: entry.path,
    });
  } else if (entry.name !== entry.slug) {
    entry.diagnostics.push({
      severity: "error",
      code: "name_slug_mismatch",
      message: "Skill name must match its directory slug.",
      path: entry.path,
    });
  }

  if (entry.description === null || entry.description.trim() === "") {
    entry.diagnostics.push({
      severity: "error",
      code: "description_missing",
      message: "Skill frontmatter must include a non-empty description.",
      path: entry.path,
    });
  } else if (entry.description.length > 1024) {
    entry.diagnostics.push({
      severity: "error",
      code: "description_too_long",
      message: "Skill description exceeds 1024 characters.",
      path: entry.path,
    });
  }

  if (entry.bodyMarkdown === null || entry.bodyMarkdown.trim() === "") {
    entry.diagnostics.push({
      severity: "error",
      code: "body_missing",
      message: "Skill file must include non-empty body markdown.",
      path: entry.path,
    });
  }
}

function validateOptionalFields(
  entry: ParsedSkillEntry,
  data: Record<string, FrontmatterValue>
): void {
  warnMalformedString(entry, data, "license", 256, "license_invalid");
  warnMalformedString(
    entry,
    data,
    "compatibility",
    512,
    "compatibility_invalid"
  );
  warnMalformedString(
    entry,
    data,
    "allowed-tools",
    2048,
    "allowed-tools_invalid"
  );

  if (data.metadata === undefined) {
    return;
  }

  if (!isRecord(data.metadata) || Array.isArray(data.metadata)) {
    entry.diagnostics.push({
      severity: "warning",
      code: "metadata_invalid",
      message: "Skill metadata must be a shallow map.",
      path: entry.path,
    });
    return;
  }

  for (const [key, value] of Object.entries(data.metadata)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      entry.metadata[key] = value;
      continue;
    }
    entry.diagnostics.push({
      severity: "warning",
      code: "metadata_value_invalid",
      message: "Skill metadata values must be JSON scalars.",
      path: entry.path,
      details: { key },
    });
  }
}

function warnMalformedString(
  entry: ParsedSkillEntry,
  data: Record<string, FrontmatterValue>,
  field: string,
  maxLength: number,
  code: string
): void {
  const value = data[field];
  if (value === undefined) {
    return;
  }
  if (typeof value !== "string" || value.length > maxLength) {
    entry.diagnostics.push({
      severity: "warning",
      code,
      message: `Skill ${field} must be a string no longer than ${maxLength} characters.`,
      path: entry.path,
    });
  }
}

function isRecord(value: unknown): value is Record<string, FrontmatterValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalSkillPath(path: string, slug: string): boolean {
  return path === `skills/${slug}/SKILL.md`;
}

function isStandardResourceKind(
  value: string | undefined
): value is "assets" | "references" | "scripts" {
  return value === "assets" || value === "references" || value === "scripts";
}

function ensureResources(
  resourcesBySlug: Map<string, SkillResources>,
  slug: string
): SkillResources {
  const existing = resourcesBySlug.get(slug);
  if (existing) {
    return existing;
  }
  const resources = emptyResources();
  resourcesBySlug.set(slug, resources);
  return resources;
}

function addResourcePath(
  resourcesBySlug: Map<string, SkillResources>,
  slug: string,
  kind: "assets" | "references" | "scripts",
  path: string
): void {
  const resources = ensureResources(resourcesBySlug, slug);
  const total =
    resources.assets.length + resources.references.length + resources.scripts.length;
  if (total >= SKILL_RESOURCE_PATH_MAX) {
    resources.truncated = true;
    return;
  }
  resources[kind].push(path);
}

function sortResources(resourcesBySlug: Map<string, SkillResources>): void {
  for (const resources of resourcesBySlug.values()) {
    resources.assets.sort();
    resources.references.sort();
    resources.scripts.sort();
  }
}
