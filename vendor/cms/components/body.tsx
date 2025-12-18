import { RichText } from "basehub/react-rich-text";
import type { ComponentProps, ReactNode } from "react";
import { CMSCodeBlock } from "@repo/ui/components/cms-code-block";

type BodyProps = ComponentProps<typeof RichText>;

// Base components for rich text rendering
const richTextBaseComponents = {
  // Tighter list spacing
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-4 space-y-1 list-disc pl-6">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-4 space-y-1 list-decimal pl-6">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="my-1">{children}</li>
  ),

  // Table elements with responsive wrapper
  table: ({
    children,
    ...props
  }: { children?: ReactNode } & React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 overflow-x-auto">
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
    <tbody className="divide-y divide-border/40 bg-card" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children }: { children?: ReactNode }) => <tr>{children}</tr>,
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
      className="whitespace-nowrap text-left font-semibold text-sm"
      style={{ padding: "0.375rem 1rem" }}
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
    <td
      className="text-sm"
      style={{ padding: "0.375rem 1rem" }}
      colSpan={colspan}
      rowSpan={rowspan}
    >
      {children}
    </td>
  ),

  // Pre renders the code block wrapper with syntax highlighting
  pre: ({
    children,
    code,
    language,
  }: {
    children?: ReactNode;
    code?: string;
    language?: string;
  }) => (
    <CMSCodeBlock code={code} language={language}>
      {children}
    </CMSCodeBlock>
  ),

  // Code - inline gets styled, block just passes through (pre handles it)
  code: ({
    children,
    isInline,
  }: {
    children?: ReactNode;
    isInline?: boolean;
  }) => {
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
          {children}
        </code>
      );
    }
    // Block code - just pass through, pre wrapper handles styling
    return <>{children}</>;
  },
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
