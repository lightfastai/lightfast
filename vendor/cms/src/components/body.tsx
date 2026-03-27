import { RichText } from "basehub/react-rich-text";
import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/utils";

type CodeBlockRenderer = (props: {
  children: string;
  language?: string;
  className?: string;
}) => ReactNode | Promise<ReactNode>;

type BodyProps = ComponentProps<typeof RichText> & {
  className?: string;
  codeBlockComponent?: CodeBlockRenderer;
};

// Base components factory — closes over the optional code block renderer
function createRichTextComponents(codeBlockComponent?: CodeBlockRenderer) {
  return {
    // Tighter list spacing
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="mb-3 ml-6 list-disc text-foreground [&>li:not(:first-child)]:mt-1">
        {children}
      </ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="mb-3 ml-6 list-decimal text-foreground [&>li:not(:first-child)]:mt-1">
        {children}
      </ol>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li className="break-words text-foreground/90 leading-7">{children}</li>
    ),

    // Table elements with responsive wrapper
    table: ({
      children,
      ...props
    }: { children?: ReactNode } & React.HTMLAttributes<HTMLTableElement>) => (
      <div className="my-6 overflow-hidden overflow-x-auto rounded-xs text-foreground">
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
      <tr className="transition-colors hover:bg-muted/50">{children}</tr>
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
      <td
        className="px-4 py-3 align-top text-sm"
        colSpan={colspan}
        rowSpan={rowspan}
      >
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
      // If we have code content and a code block renderer, use SSR highlighting
      if (code && codeBlockComponent) {
        return codeBlockComponent({
          children: code,
          language,
          className: cn("my-4", className),
        });
      }

      // Fallback for content without code prop or no renderer
      return <pre className={cn("my-4", className)}>{children}</pre>;
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
              "rounded-md bg-muted/50 px-1 py-0.5 font-mono text-sm",
              className
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
      if (!src) {
        return null;
      }
      return (
        <div className="relative my-6 aspect-[4/3] overflow-hidden rounded-xs bg-card">
          <Image
            alt={alt ?? ""}
            className="object-cover"
            fill
            priority
            quality={85}
            src={src}
          />
        </div>
      );
    },

    // Link - always opens in new tab for CMS content
    a: ({ children, href }: { children?: ReactNode; href?: string }) => {
      if (!href) {
        return <span>{children}</span>;
      }
      return (
        <a
          className="text-primary underline underline-offset-4 hover:text-primary/80"
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {children}
        </a>
      );
    },

    // Heading components with consistent styling
    h1: ({ children }: { children?: ReactNode }) => (
      <h1 className="mt-6 mb-4 scroll-m-20 font-bold text-2xl tracking-tight">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="mt-6 mb-3 scroll-m-20 font-semibold text-xl tracking-tight">
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3 className="mt-5 mb-2 scroll-m-20 font-semibold text-lg tracking-tight">
        {children}
      </h3>
    ),
    h4: ({ children }: { children?: ReactNode }) => (
      <h4 className="mt-4 mb-2 scroll-m-20 font-semibold text-base tracking-tight">
        {children}
      </h4>
    ),

    // Typography
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }: { children?: ReactNode }) => (
      <em className="italic">{children}</em>
    ),

    // Paragraph - no font size here, inherited from Body wrapper
    p: ({ children }: { children?: ReactNode }) => (
      <p className="break-words leading-7 [&:not(:first-child)]:mt-3">
        {children}
      </p>
    ),

    // Blockquote for quotes
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="mt-6 border-border border-l-2 pl-6 text-foreground/80 italic">
        {children}
      </blockquote>
    ),

    // Horizontal rule with reduced spacing
    hr: () => <hr className="my-8 border-border/40" />,
  };
}

export const Body = ({
  components,
  className,
  codeBlockComponent,
  ...props
}: BodyProps) => (
  <div
    className={cn(
      "text-md [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      className
    )}
  >
    <RichText
      // @ts-expect-error BaseHub RichText components typing issue
      components={{
        ...createRichTextComponents(codeBlockComponent),
        // Allow consumer overrides
        ...components,
      }}
      {...props}
    />
  </div>
);

// Keep simple export for cases that need raw RichText
export { RichText as SimpleBody } from "basehub/react-rich-text";
