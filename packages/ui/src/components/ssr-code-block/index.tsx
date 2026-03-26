import { cn } from "@repo/ui/lib/utils";
import langBash from "@shikijs/langs/bash";
import langCss from "@shikijs/langs/css";
import langGo from "@shikijs/langs/go";
import langHtml from "@shikijs/langs/html";
import langJs from "@shikijs/langs/javascript";
import langJson from "@shikijs/langs/json";
import langJsonc from "@shikijs/langs/jsonc";
import langJsx from "@shikijs/langs/jsx";
import langMarkdown from "@shikijs/langs/markdown";
import langPy from "@shikijs/langs/python";
import langRust from "@shikijs/langs/rust";
import langSql from "@shikijs/langs/sql";
import langTsx from "@shikijs/langs/tsx";
import langTs from "@shikijs/langs/typescript";
import langYaml from "@shikijs/langs/yaml";
import githubLightDefault from "@shikijs/themes/github-light-default";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import type { BundledLanguage } from "shiki";
import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { SSRCodeBlockCopyButton } from "./copy-button";
import { openaiDark } from "./openai-dark-theme";

// Singleton highlighter — initialized once, reused across all SSR renders
let _highlighterPromise: Promise<HighlighterCore> | null = null;

function getHighlighter(): Promise<HighlighterCore> {
  if (!_highlighterPromise) {
    _highlighterPromise = createHighlighterCore({
      themes: [githubLightDefault, openaiDark],
      langs: [
        langTs,
        langJs,
        langTsx,
        langJsx,
        langBash,
        langJson,
        langJsonc,
        langYaml,
        langPy,
        langGo,
        langRust,
        langSql,
        langCss,
        langHtml,
        langMarkdown,
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return _highlighterPromise;
}

// Re-export types for consumers
export type { BundledLanguage, BundledTheme } from "shiki";

interface SSRCodeBlockProps {
  children: string;
  className?: string;
  language?: string;
  showHeader?: boolean;
}

export async function SSRCodeBlock({
  children,
  language = "typescript",
  className,
  showHeader = true,
}: SSRCodeBlockProps) {
  const code = children.trim();

  // Normalize language names - handle common aliases and invalid languages
  let lang: BundledLanguage = language as BundledLanguage;
  const languageLower = language.toLowerCase();

  // Map common invalid/alias names to valid Shiki languages
  const languageMap: Record<string, BundledLanguage> = {
    plaintext: "plaintext" as BundledLanguage,
    plain: "plaintext" as BundledLanguage,
  };

  const mappedLang = languageMap[languageLower];
  if (mappedLang) {
    lang = mappedLang;
  }

  // Type for HAST tree nodes, extracted from toJsxRuntime's expected parameter
  type HastNodes = Parameters<typeof toJsxRuntime>[0];

  // Generate HAST for both themes in parallel, with fallback to plain text
  const hl = await getHighlighter();
  let lightHast: HastNodes;
  let darkHast: HastNodes;
  try {
    [lightHast, darkHast] = (await Promise.all([
      hl.codeToHast(code, {
        lang,
        theme: "github-light-default",
      }),
      hl.codeToHast(code, {
        lang,
        theme: "openai-dark",
      }),
    ])) as [HastNodes, HastNodes];
  } catch {
    // If language is not supported, fall back to plain text
    [lightHast, darkHast] = (await Promise.all([
      hl.codeToHast(code, {
        lang: "text",
        theme: "github-light-default",
      }),
      hl.codeToHast(code, {
        lang: "text",
        theme: "openai-dark",
      }),
    ])) as [HastNodes, HastNodes];
  }

  // Convert HAST to JSX for both themes
  // Override elements to control styling while preserving Shiki's syntax colors
  // IMPORTANT: leading-[1.7] must be set here directly because the className overrides parent styles
  const createShikiComponents = (mode: "light" | "dark") => ({
    pre: ({
      style: _style,
      ...props
    }: {
      style?: React.CSSProperties;
      [key: string]: unknown;
    }) => (
      <pre
        {...props}
        className="m-0 border-0 bg-transparent p-0 leading-[1.7]! tracking-normal"
      />
    ),
    code: ({
      style: _style,
      ...props
    }: {
      style?: React.CSSProperties;
      [key: string]: unknown;
    }) => <code {...props} className="block leading-[1.7]!" />,
    // Ensure spans have visible text color - use Shiki's color if provided, else fallback
    span: ({
      style,
      ...props
    }: {
      style?: React.CSSProperties;
      [key: string]: unknown;
    }) => {
      const colorValue = style?.color;
      const hasColor = colorValue && colorValue !== "inherit";
      const fallbackColor = mode === "light" ? "#24292e" : "#dcdcdc";
      return (
        <span
          {...props}
          className="leading-[1.7]!"
          style={{
            ...style,
            color: hasColor ? colorValue : fallbackColor,
            letterSpacing: "normal",
          }}
        />
      );
    },
  });

  function hastToJsx(hast: HastNodes, mode: "light" | "dark"): React.ReactNode {
    // toJsxRuntime types depend on the `hast` module which eslint's type checker
    // cannot fully resolve, requiring the explicit cast here
    return toJsxRuntime(hast, {
      Fragment,
      jsx,
      jsxs,
      components: createShikiComponents(mode),
    } as Parameters<typeof toJsxRuntime>[1]) as React.ReactNode;
  }

  const lightJsx = hastToJsx(lightHast, "light");
  const darkJsx = hastToJsx(darkHast, "dark");

  return (
    <div className={cn("my-4", className)}>
      <div className="scrollbar-thin overflow-hidden rounded-sm dark:bg-card/80">
        {/* Header with language label and copy button */}
        {showHeader && (
          <div className="flex items-center justify-between py-2 pr-3 pl-6">
            <span className="font-medium font-mono text-muted-foreground text-xs">
              {language}
            </span>
            <SSRCodeBlockCopyButton code={code} />
          </div>
        )}

        {/* Code content with line numbers */}
        <div className="overflow-x-auto px-6 pb-4">
          <div className="flex min-w-max">
            {/* Code content - dual theme rendering */}
            {/* text-foreground provides base color for plain text (no syntax highlighting) */}
            <div className="flex-1 text-foreground">
              {/* Light theme - hidden in dark mode */}
              <div className="block font-mono text-xs dark:hidden">
                {lightJsx}
              </div>
              {/* Dark theme - hidden in light mode */}
              <div className="hidden font-mono text-sm dark:block">
                {darkJsx}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export the copy button for consumers who need it separately
export { SSRCodeBlockCopyButton } from "./copy-button";
