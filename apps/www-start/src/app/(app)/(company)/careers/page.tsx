import type { ReactNode } from "react";

export const FALLBACK_CAREERS_CONTENT = `LIGHTFAST █

~~~

CONTACT: JOBS@LIGHTFAST.AI
LOCATION: REMOTE
STATUS: ONLINE
OPEN POSITIONS: None for now.

~~~

LINKS:
 - [Lightfast](https://github.com/lightfastai/lightfast)
 - [Program Specification](https://github.com/lightfastai/.lightfast)`;

function decodeBase64Content(content: string) {
  const normalized = content.replace(/\n/g, "");

  if (typeof Buffer !== "undefined") {
    return Buffer.from(normalized, "base64").toString("utf-8");
  }

  const binary = globalThis.atob(normalized);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  );

  return new TextDecoder().decode(bytes);
}

function readCareersContent(data: unknown) {
  if (
    typeof data !== "object" ||
    data === null ||
    !("content" in data) ||
    !("encoding" in data) ||
    typeof data.content !== "string" ||
    typeof data.encoding !== "string"
  ) {
    return FALLBACK_CAREERS_CONTENT;
  }

  if (data.encoding === "base64") {
    return decodeBase64Content(data.content);
  }

  return data.content;
}

export async function getCareersContent(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/lightfastai/careers/contents/README.md",
      {
        cache: "force-cache",
        headers: { Accept: "application/vnd.github.v3+json" },
      }
    );

    if (!res.ok) {
      return FALLBACK_CAREERS_CONTENT;
    }

    return readCareersContent(await res.json());
  } catch {
    return FALLBACK_CAREERS_CONTENT;
  }
}

function MarkdownLine({ line }: { line: string }): ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match;

  while ((match = linkRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    const text = match[1] ?? "";
    const href = match[2] ?? "";

    parts.push(`[${text}]`);
    parts.push(
      <a
        className="text-blue-400 underline underline-offset-2 transition-opacity hover:opacity-80"
        href={href}
        key={key++}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        target={href.startsWith("http") ? "_blank" : undefined}
      >
        ({href})
      </a>
    );
    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts.length > 0 ? parts : line;
}

interface CareersPageProps {
  content?: string;
}

export default function CareersPage({
  content,
}: CareersPageProps = {}) {
  const resolvedContent = content ?? FALLBACK_CAREERS_CONTENT;
  const lines = resolvedContent.split("\n");

  return (
    <main className="min-h-screen px-6 pt-24 pb-16">
      <pre className="whitespace-pre-wrap font-mono text-foreground/80 text-sm leading-relaxed">
        {lines.map((line, i) => (
          <span key={i}>
            <MarkdownLine line={line} />
            {i < lines.length - 1 ? "\n" : null}
          </span>
        ))}
      </pre>
    </main>
  );
}
