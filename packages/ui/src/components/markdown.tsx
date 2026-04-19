"use client";

import { cn } from "@repo/ui/lib/utils";
import type React from "react";
import { isValidElement, memo } from "react";
import type { Components as ReactMarkdownComponents } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { BundledLanguage } from "shiki";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
} from "./ai-elements/code-block";

// Properly typed component props based on react-markdown's actual types
type MarkdownComponentProps = React.HTMLAttributes<HTMLElement> & {
  node?: unknown; // Using unknown instead of any for better type safety
  children?: React.ReactNode;
};

// Code component specific props
interface CodeComponentProps extends MarkdownComponentProps {
  inline?: boolean;
}

/**
 * Custom components for react-markdown with Next.js optimizations
 * All components are properly typed and styled with Tailwind CSS
 */
const components: Partial<ReactMarkdownComponents> = {
  // Code components - handles both inline and block code
  code({
    node: _node,
    inline,
    className,
    children,
    ...props
  }: CodeComponentProps) {
    const isInline = inline ?? false;

    // Inline code styling
    if (isInline) {
      return (
        <code
          className={cn(
            "rounded-md bg-muted/50 px-1 py-0.5 font-mono text-xs",
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    // Block code without syntax highlighting (handled by pre component)
    return (
      <code className={cn("font-mono text-xs", className)} {...props}>
        {children}
      </code>
    );
  },

  // Pre component for code blocks
  pre({ node: _node, className, children }: MarkdownComponentProps) {
    let language: BundledLanguage = "javascript";

    const node = _node as { properties?: { className?: string } } | undefined;
    if (node?.properties && typeof node.properties.className === "string") {
      language = node.properties.className.replace(
        "language-",
        ""
      ) as BundledLanguage;
    }

    // Extract code content from children safely
    let code = "";
    if (
      isValidElement(children) &&
      children.props &&
      typeof children.props === "object" &&
      "children" in children.props &&
      typeof children.props.children === "string"
    ) {
      code = children.props.children;
    } else if (typeof children === "string") {
      code = children;
    }

    return (
      <CodeBlock
        className={cn(
          "my-4 h-auto rounded-md border border-border",
          "bg-muted/50 dark:bg-muted/20",
          className
        )}
      >
        <CodeBlockHeader language={language}>
          <CodeBlockActions>
            <CodeBlockCopyButton />
          </CodeBlockActions>
        </CodeBlockHeader>
        <CodeBlockContent className="p-3" code={code} language={language} />
      </CodeBlock>
    );
  },

  // Typography components
  strong({ children, ...props }: MarkdownComponentProps) {
    return (
      <strong className="font-semibold" {...props}>
        {children}
      </strong>
    );
  },

  em({ children, ...props }: MarkdownComponentProps) {
    return (
      <em className="italic" {...props}>
        {children}
      </em>
    );
  },

  // Link component with Next.js best practices
  a({ href, children, ...props }: MarkdownComponentProps & { href?: string }) {
    const isExternal = href?.startsWith("http");
    return (
      <a
        className="text-blue-500 underline underline-offset-2 transition-colors hover:text-blue-600"
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },

  // Heading components with consistent styling (reduced by one size)
  h1({ children, ...props }: MarkdownComponentProps) {
    return (
      <h1
        className="mt-6 mb-4 scroll-m-20 font-bold text-xl tracking-tight first:mt-0"
        {...props}
      >
        {children}
      </h1>
    );
  },

  h2({ children, ...props }: MarkdownComponentProps) {
    return (
      <h2
        className="mt-5 mb-3 scroll-m-20 font-semibold text-lg tracking-tight"
        {...props}
      >
        {children}
      </h2>
    );
  },

  h3({ children, ...props }: MarkdownComponentProps) {
    return (
      <h3
        className="mt-4 mb-2 scroll-m-20 font-semibold text-base tracking-tight"
        {...props}
      >
        {children}
      </h3>
    );
  },

  h4({ children, ...props }: MarkdownComponentProps) {
    return (
      <h4
        className="mt-3 mb-2 scroll-m-20 font-semibold text-sm tracking-tight"
        {...props}
      >
        {children}
      </h4>
    );
  },

  h5({ children, ...props }: MarkdownComponentProps) {
    return (
      <h5
        className="mt-2 mb-1 scroll-m-20 font-semibold text-xs tracking-tight"
        {...props}
      >
        {children}
      </h5>
    );
  },

  h6({ children, ...props }: MarkdownComponentProps) {
    return (
      <h6
        className="mt-2 mb-1 scroll-m-20 font-semibold text-xs tracking-tight"
        {...props}
      >
        {children}
      </h6>
    );
  },

  // Paragraph with proper spacing and text-sm
  p({ children, ...props }: MarkdownComponentProps) {
    return (
      <p
        className="break-words text-sm leading-7 [&:not(:first-child)]:mt-3"
        {...props}
      >
        {children}
      </p>
    );
  },

  // List components
  ul({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <ul
        className={cn("my-3 ml-6 list-disc [&>li]:mt-1", className)}
        {...props}
      >
        {children}
      </ul>
    );
  },

  ol({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <ol
        className={cn("my-3 ml-6 list-decimal [&>li]:mt-1", className)}
        {...props}
      >
        {children}
      </ol>
    );
  },

  li({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <li className={cn("break-words text-sm leading-7", className)} {...props}>
        {children}
      </li>
    );
  },

  // Horizontal rule
  hr({ ...props }: MarkdownComponentProps) {
    return <hr className="my-6 border-border" {...props} />;
  },

  // Blockquote
  blockquote({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <blockquote
        className={cn(
          "mt-3 border-border border-l-4 pl-4 text-muted-foreground text-sm italic",
          className
        )}
        {...props}
      >
        {children}
      </blockquote>
    );
  },

  // Table components with better styling
  table({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <div className="my-3 w-full overflow-y-auto">
        <table className={cn("w-full border-collapse", className)} {...props}>
          {children}
        </table>
      </div>
    );
  },

  thead({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <thead className={cn("border-b", className)} {...props}>
        {children}
      </thead>
    );
  },

  tbody({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props}>
        {children}
      </tbody>
    );
  },

  tr({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <tr
        className={cn(
          "border-b transition-colors hover:bg-muted/50",
          className
        )}
        {...props}
      >
        {children}
      </tr>
    );
  },

  th({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <th
        className={cn(
          "h-10 break-words px-2 text-left align-middle font-medium text-muted-foreground text-sm [&:has([role=checkbox])]:pr-0",
          className
        )}
        {...props}
      >
        {children}
      </th>
    );
  },

  td({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <td
        className={cn(
          "break-words p-2 align-middle text-sm [&:has([role=checkbox])]:pr-0",
          className
        )}
        {...props}
      >
        {children}
      </td>
    );
  },
};

// Configure remark plugins
const remarkPlugins = [remarkGfm];

// Props for the Markdown component
export interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Non-memoized Markdown component
 * Renders markdown content with custom styling
 */
const NonMemoizedMarkdown = ({ children, className }: MarkdownProps) => (
  <div className={cn("w-full break-words", className)}>
    <ReactMarkdown components={components} remarkPlugins={remarkPlugins}>
      {children}
    </ReactMarkdown>
  </div>
);

/**
 * Memoized Markdown component for better performance
 * Only re-renders when the markdown content changes
 */
export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

// Export the non-memoized version for cases where memoization isn't needed
export { NonMemoizedMarkdown };

// Export the components object for use with Fumadocs and other MDX systems
export const markdownComponents = components;
