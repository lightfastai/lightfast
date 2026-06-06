import type {
  SignalEntityLinkCandidate,
  SignalEntityMentionKind,
} from "./schema";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const HANDLE_PATTERN = /(^|[^\w@.])@[A-Z0-9_]{1,30}\b/gi;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/gi;

const MAX_SIGNAL_ENTITY_LINK_CANDIDATES = 10;
const TRAILING_LABEL_PUNCTUATION_PATTERN = /[.,;:!?]+$/g;

type DeterministicMentionKind = Extract<
  SignalEntityMentionKind,
  "email" | "handle" | "profile_url"
>;

interface DeterministicMatch {
  mentionKind: DeterministicMentionKind;
  label: string;
  anchorText: string;
  start: number;
  end: number;
  rationale: string;
}

interface TextRange {
  start: number;
  end: number;
}

export function extractDeterministicSignalEntityLinks(input: {
  input: string;
}): SignalEntityLinkCandidate[] {
  const deterministicMatches = [
    ...findEmailMatches(input.input),
    ...findRecognizedProfileUrlMatches(input.input),
  ];
  const occupiedRanges = deterministicMatches.map(({ start, end }) => ({
    start,
    end,
  }));

  deterministicMatches.push(...findHandleMatches(input.input, occupiedRanges));

  return deterministicMatches
    .sort((left, right) => left.start - right.start)
    .map((match, index) => ({
      targetType: "person",
      localEntityKey: `person_${index + 1}`,
      label: match.label,
      mentionKind: match.mentionKind,
      anchorText: match.anchorText,
      anchorOccurrence: getAnchorOccurrenceAt(
        input.input,
        match.anchorText,
        match.start
      ),
      extractionMethod: "deterministic",
      rationale: match.rationale,
      confidence: 1,
    }));
}

export function mergeSignalEntityLinkCandidates(input: {
  aiCandidates: SignalEntityLinkCandidate[];
  deterministicCandidates: SignalEntityLinkCandidate[];
  input: string;
}): SignalEntityLinkCandidate[] {
  const mergedCandidates: SignalEntityLinkCandidate[] = [];
  const seenCandidateKeys = new Set<string>();

  for (const candidate of [
    ...input.deterministicCandidates,
    ...input.aiCandidates,
  ]) {
    if (
      !hasAnchorOccurrence(
        input.input,
        candidate.anchorText,
        candidate.anchorOccurrence
      )
    ) {
      continue;
    }

    const candidateKey = [
      candidate.targetType,
      candidate.mentionKind,
      candidate.anchorText,
      candidate.anchorOccurrence,
    ].join("\u001f");

    if (seenCandidateKeys.has(candidateKey)) {
      continue;
    }

    seenCandidateKeys.add(candidateKey);
    mergedCandidates.push(candidate);

    if (mergedCandidates.length >= MAX_SIGNAL_ENTITY_LINK_CANDIDATES) {
      break;
    }
  }

  return mergedCandidates;
}

function findEmailMatches(input: string): DeterministicMatch[] {
  const matches: DeterministicMatch[] = [];

  for (const match of input.matchAll(EMAIL_PATTERN)) {
    const rawLabel = match[0];
    const label = stripTrailingLabelPunctuation(rawLabel);
    const start = match.index ?? 0;

    matches.push({
      mentionKind: "email",
      label,
      anchorText: label,
      start,
      end: start + label.length,
      rationale: "Email address matched deterministic extractor.",
    });
  }

  return matches;
}

function findRecognizedProfileUrlMatches(input: string): DeterministicMatch[] {
  const matches: DeterministicMatch[] = [];

  for (const match of input.matchAll(URL_PATTERN)) {
    const rawLabel = match[0];
    const label = stripTrailingLabelPunctuation(rawLabel);

    if (!isRecognizedPersonProfileUrl(label)) {
      continue;
    }

    const start = match.index ?? 0;

    matches.push({
      mentionKind: "profile_url",
      label,
      anchorText: label,
      start,
      end: start + label.length,
      rationale: "Profile URL matched deterministic extractor.",
    });
  }

  return matches;
}

function findHandleMatches(
  input: string,
  occupiedRanges: TextRange[]
): DeterministicMatch[] {
  const matches: DeterministicMatch[] = [];

  for (const match of input.matchAll(HANDLE_PATTERN)) {
    const rawMatch = match[0];
    const prefix = match[1] ?? "";
    const label = rawMatch.slice(prefix.length);
    const start = (match.index ?? 0) + prefix.length;
    const end = start + label.length;

    if (isRangeInsideAnyRange({ start, end }, occupiedRanges)) {
      continue;
    }

    matches.push({
      mentionKind: "handle",
      label,
      anchorText: label,
      start,
      end,
      rationale: "Handle matched deterministic extractor.",
    });
  }

  return matches;
}

function stripTrailingLabelPunctuation(label: string): string {
  return label.replace(TRAILING_LABEL_PUNCTUATION_PATTERN, "");
}

function isRecognizedPersonProfileUrl(label: string): boolean {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(label);
  } catch {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

  if (hostname === "linkedin.com") {
    return (
      pathSegments[0]?.toLowerCase() === "in" &&
      typeof pathSegments[1] === "string" &&
      pathSegments[1].length > 0
    );
  }

  if (
    hostname === "x.com" ||
    hostname === "twitter.com" ||
    hostname === "github.com"
  ) {
    return pathSegments.length > 0;
  }

  return false;
}

function isRangeInsideAnyRange(range: TextRange, ranges: TextRange[]): boolean {
  return ranges.some(
    (occupiedRange) =>
      range.start >= occupiedRange.start && range.end <= occupiedRange.end
  );
}

function getAnchorOccurrenceAt(
  input: string,
  anchorText: string,
  startIndex: number
): number {
  let occurrence = 0;
  let searchIndex = 0;

  while (searchIndex <= startIndex) {
    const foundIndex = input.indexOf(anchorText, searchIndex);

    if (foundIndex === -1 || foundIndex > startIndex) {
      break;
    }

    occurrence += 1;

    if (foundIndex === startIndex) {
      return occurrence;
    }

    searchIndex = foundIndex + anchorText.length;
  }

  return Math.max(occurrence, 1);
}

function hasAnchorOccurrence(
  input: string,
  anchorText: string,
  anchorOccurrence: number
): boolean {
  if (
    anchorText.length === 0 ||
    !Number.isInteger(anchorOccurrence) ||
    anchorOccurrence < 1
  ) {
    return false;
  }

  let occurrence = 0;
  let searchIndex = 0;

  while (searchIndex < input.length) {
    const foundIndex = input.indexOf(anchorText, searchIndex);

    if (foundIndex === -1) {
      return false;
    }

    occurrence += 1;

    if (occurrence === anchorOccurrence) {
      return true;
    }

    searchIndex = foundIndex + anchorText.length;
  }

  return false;
}
