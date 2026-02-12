import type { BundledLanguage } from "shiki";
import { codeToHast } from "shiki";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { cn } from "@repo/ui/lib/utils";
import { SSRCodeBlockCopyButton } from "./copy-button";

// Re-export types for consumers
export type { BundledLanguage, BundledTheme } from "shiki";

interface SSRCodeBlockProps {
  children: string;
  language?: string;
  className?: string;
  showHeader?: boolean;
  showLineNumbers?: boolean;
}

export async function SSRCodeBlock({
  children,
  language = "typescript",
  className,
  showHeader = true,
  showLineNumbers = true,
}: SSRCodeBlockProps) {
  const code = children.trim();
  const lang = language as BundledLanguage;
  const lineCount = code.split("\n").length;

  // Generate HAST for both themes in parallel
  const [lightHast, darkHast] = await Promise.all([
    codeToHast(code, {
      lang,
      theme: "github-light",
    }),
    codeToHast(code, {
      lang,
      theme: "github-dark",
    }),
  ]);

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
        className="m-0 p-0 bg-transparent border-0 leading-[1.7]"
      />
    ),
    code: ({
      style: _style,
      ...props
    }: {
      style?: React.CSSProperties;
      [key: string]: unknown;
    }) => <code {...props} className="block leading-[1.7]" />,
    // Ensure spans have visible text color - use Shiki's color if provided, else fallback
    span: ({
      style,
      ...props
    }: {
      style?: React.CSSProperties;
      [key: string]: unknown;
    }) => {
      const hasColor = style?.color && style.color !== "inherit";
      const fallbackColor = mode === "light" ? "#24292e" : "#e1e4e8";
      return (
        <span
          {...props}
          style={{
            ...style,
            color: hasColor ? style?.color : fallbackColor,
          }}
        />
      );
    },
  });

  const lightJsx = toJsxRuntime(lightHast, {
    Fragment,
    jsx,
    jsxs,
    components: createShikiComponents("light"),
  });

  const darkJsx = toJsxRuntime(darkHast, {
    Fragment,
    jsx,
    jsxs,
    components: createShikiComponents("dark"),
  });

  // Generate line numbers
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className={cn("my-4", className)}>
      <div className="rounded-sm border dark:bg-card overflow-hidden scrollbar-thin">
        {/* Header with language label and copy button */}
        {showHeader && (
          <div className="flex items-center justify-between px-6 py-2">
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {language}
            </span>
            <SSRCodeBlockCopyButton code={code} />
          </div>
        )}

        {/* Code content with line numbers */}
        <div className="overflow-x-auto px-6 pt-2 pb-4">
          <div className="flex min-w-max">
            {/* Code content - dual theme rendering */}
            {/* text-foreground provides base color for plain text (no syntax highlighting) */}
            <div className="flex-1 text-foreground">
              {/* Light theme - hidden in dark mode */}
              <div className="block dark:hidden font-mono text-xs">
                {lightJsx}
              </div>
              {/* Dark theme - hidden in light mode */}
              <div className="hidden dark:block font-mono text-xs">
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
