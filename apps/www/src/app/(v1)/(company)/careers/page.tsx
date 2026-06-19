import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Careers",
  description: "Open positions at Lightfast.",
};

// Regenerate on each Vercel deployment, no runtime revalidation
export const revalidate = false;

const FALLBACK = `LIGHTFAST █

~~~

CONTACT: JOBS@LIGHTFAST.AI
LOCATION: REMOTE
STATUS: ONLINE
OPEN POSITIONS: None for now.

~~~

LINKS:
 - [Lightfast](https://github.com/lightfastai/lightfast)
 - [Program Specification](https://github.com/lightfastai/.lightfast)`;

async function getCareersContent(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/lightfastai/careers/contents/README.md",
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        next: { revalidate: false },
      }
    );
    if (!res.ok) {
      return FALLBACK;
    }
    const data = (await res.json()) as { content: string; encoding: string };
    if (data.encoding === "base64") {
      return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString(
        "utf-8"
      );
    }
    return data.content;
  } catch {
    return FALLBACK;
  }
}

// Renders a single line, turning [text](url) into clickable links
// while preserving the raw markdown syntax visually.
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
    // Render [text] as plain + (url) as the hyperlink
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

export default async function CareersPage() {
  const content = await getCareersContent();
  const lines = content.split("\n");

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
