import type { EntityCategory } from "@repo/console-validation";
import type { ExtractedEntity } from "@repo/console-types";

/**
 * Entity extraction pattern definition
 */
interface ExtractionPattern {
  category: EntityCategory;
  pattern: RegExp;
  confidence: number;
  keyExtractor: (match: RegExpMatchArray) => string;
  valueExtractor?: (match: RegExpMatchArray) => string;
}

/**
 * Entity extraction patterns ordered by specificity
 */
const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  // API Endpoints - highest confidence, very specific pattern
  {
    category: "endpoint",
    pattern: /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s"'<>]{1,200})/gi,
    confidence: 0.95,
    keyExtractor: (m) => `${m[1]?.toUpperCase()} ${m[2]}`,
    valueExtractor: (m) => m[2] || "",
  },

  // Issue/PR References - GitHub style
  {
    category: "project",
    pattern: /(#\d{1,6})/g,
    confidence: 0.95,
    keyExtractor: (m) => m[1] || "",
  },

  // Issue/PR References - Linear/Jira style (e.g., ENG-123, PROJ-456)
  {
    category: "project",
    pattern: /\b([A-Z]{2,10}-\d{1,6})\b/g,
    confidence: 0.90,
    keyExtractor: (m) => m[1] || "",
  },

  // @mentions - GitHub/Slack style
  {
    category: "engineer",
    pattern: /@([a-zA-Z0-9_-]{1,39})\b/g,
    confidence: 0.90,
    keyExtractor: (m) => `@${m[1]}`,
    valueExtractor: (m) => m[1] || "",
  },

  // Environment Variables - UPPERCASE_WITH_UNDERSCORES
  {
    category: "config",
    pattern: /\b([A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)+)\b/g,
    confidence: 0.85,
    keyExtractor: (m) => m[1] || "",
  },

  // File Paths - common patterns
  {
    category: "definition",
    pattern: /\b(?:src|lib|packages|apps|api|components)\/[^\s"'<>]{1,150}\.[a-z]{1,10}\b/gi,
    confidence: 0.80,
    keyExtractor: (m) => m[0],
  },

  // Git commit hashes (7+ chars)
  {
    category: "reference",
    pattern: /\b([a-f0-9]{7,40})\b/g,
    confidence: 0.70,
    keyExtractor: (m) => m[1]?.substring(0, 7) || "",
    valueExtractor: (m) => m[1] || "",
  },

  // Branch references
  {
    category: "reference",
    pattern: /\bbranch[:\s]+([a-zA-Z0-9/_-]{1,100})\b/gi,
    confidence: 0.75,
    keyExtractor: (m) => `branch:${m[1]}`,
    valueExtractor: (m) => m[1] || "",
  },
];

/**
 * Blacklist patterns to filter out false positives
 */
const BLACKLIST_PATTERNS: RegExp[] = [
  // Common false positives for env vars
  /^(HTTP|HTTPS|GET|POST|PUT|DELETE|API|URL|ID|DB|SQL)$/,
  // Single character entities
  /^.$/,
  // Pure numbers
  /^\d+$/,
];

/**
 * Check if an entity key should be filtered out
 */
function isBlacklisted(key: string): boolean {
  return BLACKLIST_PATTERNS.some((p) => p.test(key));
}

/**
 * Extract evidence snippet around the match
 */
function extractEvidence(text: string, matchIndex: number, matchLength: number): string {
  const contextSize = 50;
  const start = Math.max(0, matchIndex - contextSize);
  const end = Math.min(text.length, matchIndex + matchLength + contextSize);

  let evidence = text.substring(start, end);
  if (start > 0) evidence = "..." + evidence;
  if (end < text.length) evidence = evidence + "...";

  return evidence.replace(/\s+/g, " ").trim();
}

/**
 * Extract entities from observation content
 *
 * @param title - Observation title
 * @param content - Observation body content
 * @returns Array of extracted entities (deduplicated by key)
 */
export function extractEntities(title: string, content: string): ExtractedEntity[] {
  const text = `${title}\n${content}`;
  const entityMap = new Map<string, ExtractedEntity>();

  for (const pattern of EXTRACTION_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.pattern.exec(text)) !== null) {
      const key = pattern.keyExtractor(match);

      // Skip blacklisted or empty keys
      if (!key || key.length < 2 || isBlacklisted(key)) {
        continue;
      }

      // Use composite key for deduplication within extraction
      const mapKey = `${pattern.category}:${key.toLowerCase()}`;

      // Keep highest confidence match if duplicate
      const existing = entityMap.get(mapKey);
      if (!existing || existing.confidence < pattern.confidence) {
        entityMap.set(mapKey, {
          category: pattern.category,
          key,
          value: pattern.valueExtractor?.(match),
          confidence: pattern.confidence,
          evidence: extractEvidence(text, match.index, match[0].length),
        });
      }
    }
  }

  return Array.from(entityMap.values());
}

/**
 * Extract entities specifically from source references
 * (Already-structured data from GitHub/Vercel events)
 */
export function extractFromReferences(
  references: Array<{ type: string; id: string; label?: string }>
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  for (const ref of references) {
    let category: EntityCategory;
    let key: string;

    switch (ref.type) {
      case "issue":
      case "pr":
        category = "project";
        key = ref.id;
        break;
      case "commit":
      case "branch":
        category = "reference";
        key = ref.type === "branch" ? `branch:${ref.id}` : ref.id.substring(0, 7);
        break;
      case "assignee":
      case "reviewer":
        category = "engineer";
        key = `@${ref.id}`;
        break;
      default:
        category = "reference";
        key = ref.id;
    }

    entities.push({
      category,
      key,
      value: ref.label,
      confidence: 0.98, // High confidence - from structured data
      evidence: `Reference: ${ref.type}`,
    });
  }

  return entities;
}
