import type React from "react";
import { isValidElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../lib/utils";

export interface MarkdownContentProps {
  children: string;
  className?: string;
  sourcePath: string;
  sourceUrlBase: string;
}

export function MarkdownContent({
  children,
  className,
  sourcePath,
  sourceUrlBase,
}: MarkdownContentProps) {
  const components: Components = {
    a({ href, children: linkChildren }) {
      const safeHref = resolveMarkdownHref({
        href,
        sourcePath,
        sourceUrlBase,
      });

      if (!safeHref) {
        return <span>{linkChildren}</span>;
      }

      const isExternal = /^https?:\/\//i.test(safeHref);

      return (
        <a
          className="text-primary underline underline-offset-2"
          href={safeHref}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {linkChildren}
        </a>
      );
    },
    code({ className: codeClassName, children: codeChildren }) {
      return (
        <code
          className={cn(
            "rounded bg-muted px-1 py-0.5 font-mono text-xs",
            codeClassName
          )}
        >
          {codeChildren}
        </code>
      );
    },
    img({ alt, src }) {
      return (
        <span className="text-muted-foreground text-sm">
          {`Image: ${alt || src || "untitled"}`}
        </span>
      );
    },
    pre({ children: preChildren }) {
      const code = extractCode(preChildren);

      return (
        <pre className="my-4 overflow-x-auto rounded-md border bg-muted/40 p-4">
          <code
            className="block font-mono text-foreground text-xs leading-6"
            data-language={code.language}
          >
            {code.value}
          </code>
        </pre>
      );
    },
  };

  return (
    <div className={cn("prose dark:prose-invert max-w-[72ch]", className)}>
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function resolveMarkdownHref(input: {
  href: string | undefined;
  sourcePath: string;
  sourceUrlBase: string;
}): string | null {
  const href = input.href?.trim();

  if (!href) {
    return null;
  }

  if (href.startsWith("#")) {
    return href;
  }

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/")) {
    return null;
  }

  if (!input.sourceUrlBase.trim()) {
    return null;
  }

  const sourceDir = input.sourcePath.split("/").slice(0, -1).join("/");
  const parsed = parseRelativeHref(href);

  if (!parsed) {
    return null;
  }

  const normalizedPath = normalizeRelativePath(sourceDir, parsed.pathname);

  if (!normalizedPath?.startsWith(`${sourceDir}/`)) {
    return null;
  }

  const relativeTarget = normalizedPath.slice(sourceDir.length + 1);

  return `${input.sourceUrlBase.replace(/\/+$/, "")}/${encodeURI(
    relativeTarget
  )}${parsed.suffix}`;
}

function parseRelativeHref(href: string): {
  pathname: string;
  suffix: string;
} | null {
  const match = /^([^?#]*)([?#].*)?$/.exec(href);
  if (!match) {
    return null;
  }
  const suffix = match[2] ?? "";
  if (suffix && !/^[?#][^\s]*$/.test(suffix)) {
    return null;
  }
  return { pathname: match[1] ?? "", suffix };
}

function normalizeRelativePath(
  sourceDir: string,
  pathname: string
): string | null {
  let decodedPathname: string;
  try {
    decodedPathname = decodeURI(pathname);
  } catch {
    return null;
  }
  const segments = `${sourceDir}/${decodedPathname}`.split("/");
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (normalizedSegments.length === 0) {
        return null;
      }
      normalizedSegments.pop();
      continue;
    }

    normalizedSegments.push(segment);
  }

  return normalizedSegments.join("/");
}

function extractCode(children: React.ReactNode): {
  language: string;
  value: string;
} {
  if (
    isValidElement(children) &&
    children.props &&
    typeof children.props === "object" &&
    "children" in children.props
  ) {
    const props = children.props as {
      className?: unknown;
      children?: unknown;
    };
    const className =
      typeof props.className === "string" ? props.className : "";

    return {
      language: className.replace(/^language-/, "") || "text",
      value: String(props.children ?? ""),
    };
  }

  return {
    language: "text",
    value: String(children ?? ""),
  };
}
