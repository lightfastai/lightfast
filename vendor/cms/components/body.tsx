import { RichText } from "basehub/react-rich-text";
import type { ComponentProps, ReactNode } from "react";
import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
import { cn } from "@repo/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";

type BodyProps = ComponentProps<typeof RichText>;

// Base components for rich text rendering
const richTextBaseComponents = {
  // Tighter list spacing
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-4 ml-6 list-disc pl-4 not-prose text-foreground space-y-2">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-4 ml-6 list-decimal pl-4 not-prose text-foreground space-y-2">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-foreground/90 pl-4">{children}</li>
  ),

  // Table elements with responsive wrapper
  table: ({
    children,
    ...props
  }: { children?: ReactNode } & React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 overflow-x-auto rounded-xs overflow-hidden not-prose text-foreground">
      <table className="min-w-full border-collapse" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({
    children,
    ...props
  }: {
    children?: ReactNode;
  } & React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className="bg-card/90" {...props}>
      {children}
    </thead>
  ),
  tbody: ({
    children,
    ...props
  }: {
    children?: ReactNode;
  } & React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody
      className="divide-y divide-border border-border/40 bg-card"
      {...props}
    >
      {children}
    </tbody>
  ),
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="">{children}</tr>
  ),
  // BaseHub passes lowercase colspan/rowspan and colwidth - we ignore colwidth to prevent layout issues
  th: ({
    children,
    colspan,
    rowspan,
  }: {
    children?: ReactNode;
    colspan?: number;
    rowspan?: number;
    colwidth?: number[] | null;
  }) => (
    <th
      className="whitespace-nowrap px-4 py-2 text-left font-semibold text-sm"
      colSpan={colspan}
      rowSpan={rowspan}
    >
      {children}
    </th>
  ),
  td: ({
    children,
    colspan,
    rowspan,
  }: {
    children?: ReactNode;
    colspan?: number;
    rowspan?: number;
    colwidth?: number[] | null;
  }) => (
    <td className="px-4 py-3 text-sm" colSpan={colspan} rowSpan={rowspan}>
      {children}
    </td>
  ),

  // Pre renders the code block wrapper with syntax highlighting
  // BaseHub passes code and language props directly
  pre: async ({
    children,
    code,
    language,
    className,
  }: {
    children?: ReactNode;
    code?: string;
    language?: string;
    className?: string;
  }) => {
    // If we have code content, use SSR highlighting
    if (code) {
      return SSRCodeBlock({
        children: code,
        language,
        className: cn("my-6 not-prose", className),
      });
    }

    // Fallback for content without code prop
    return <pre className={cn("my-6", className)}>{children}</pre>;
  },

  // Code - inline gets styled, block just passes through (pre handles it)
  code: ({
    children,
    isInline,
    className,
  }: {
    children?: ReactNode;
    isInline?: boolean;
    className?: string;
  }) => {
    if (isInline) {
      return (
        <code
          className={cn(
            "bg-muted/50 rounded-md px-1 py-0.5 text-sm font-mono",
            className,
          )}
        >
          {children}
        </code>
      );
    }
    // Block code - just pass through, pre wrapper handles styling
    return <>{children}</>;
  },

  // Image using next/image for optimization - enforces 4:3 aspect ratio
  img: ({
    src,
    alt,
  }: {
    src?: string;
    alt?: string;
    width?: number;
    height?: number;
  }) => {
    if (!src) return null;
    return (
      <div className="relative aspect-[4/3] my-6 rounded-xs overflow-hidden bg-card">
        <Image
          src={src}
          alt={alt || ""}
          fill
          priority
          quality={40}
          className="object-cover"
        />
      </div>
    );
  },

  // Link - always opens in new tab for CMS content
  a: ({ children, href }: { children?: ReactNode; href?: string }) => {
    if (!href) return <span>{children}</span>;
    return (
      <Link
        href={href}
        className="text-primary underline underline-offset-4 hover:text-primary/80"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </Link>
    );
  },

  // Horizontal rule with reduced spacing
  hr: () => <hr className="not-prose my-8 border-border/40" />,
};

export const Body = ({ components, ...props }: BodyProps) => (
  <RichText
    // @ts-expect-error BaseHub RichText components typing issue
    components={{
      ...richTextBaseComponents,
      // Allow consumer overrides
      ...components,
    }}
    {...props}
  />
);

// Keep simple export for cases that need raw RichText
export { RichText as SimpleBody } from "basehub/react-rich-text";
