import type { BundledLanguage } from "shiki";
import { codeToHast } from "shiki";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { cn } from "@repo/ui/lib/utils";
import { SSRCodeBlockCopyButton } from "./copy-button";
import { openaiDark } from "./openai-dark-theme";

// Re-export types for consumers
export type { BundledLanguage, BundledTheme } from "shiki";

interface SSRCodeBlockProps {
  children: string;
  language?: string;
  className?: string;
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
  let lightHast: HastNodes;
  let darkHast: HastNodes;
  try {
    [lightHast, darkHast] = await Promise.all([
      codeToHast(code, {
        lang,
        theme: "github-light-default",
      }),
      codeToHast(code, {
        lang,
        theme: openaiDark,
      }),
    ]) as [HastNodes, HastNodes];
  } catch {
    // If language is not supported, fall back to plain text
    [lightHast, darkHast] = await Promise.all([
      codeToHast(code, {
        lang: "text",
        theme: "github-light-default",
      }),
      codeToHast(code, {
        lang: "text",
        theme: openaiDark,
      }),
    ]) as [HastNodes, HastNodes];
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
        className="m-0 p-0 bg-transparent border-0 leading-[1.7]! tracking-normal"
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
      <div className="rounded-sm dark:bg-card/80 overflow-hidden scrollbar-thin">
        {/* Header with language label and copy button */}
        {showHeader && (
          <div className="flex items-center justify-between pl-6 pr-3 py-2">
            <span className="text-xs font-mono font-medium text-muted-foreground">
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
              <div className="block dark:hidden font-mono text-xs">
                {lightJsx}
              </div>
              {/* Dark theme - hidden in light mode */}
              <div className="hidden dark:block font-mono text-sm">
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
