"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps } from "react";
import { isValidElement, memo } from "react";
import type { Components } from "react-markdown";
import type { BundledLanguage } from "shiki";
import { Streamdown } from "streamdown";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
} from "./code-block";

type ResponseProps = ComponentProps<typeof Streamdown>;

// Custom components following Streamdown's structure exactly
const customComponents: Partial<Components> = {
  code: ({ node, className, ...props }) => {
    const inline = node?.position?.start.line === node?.position?.end.line;

    if (!inline) {
      return <code className={className} {...props} />;
    }

    return (
      <code
        className={cn(
          "rounded-md bg-muted/50 px-1 py-0.5 font-mono text-xs",
          className
        )}
        {...props}
      />
    );
  },
  pre: ({ node, className, children }) => {
    let language: BundledLanguage = "javascript";

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
  strong: ({ children, ...props }) => (
    <strong className="font-semibold" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }) => (
    <em className="italic" {...props}>
      {children}
    </em>
  ),
  // Link component
  a: ({ href, children, ...props }) => {
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
  // Heading components with consistent styling
  h1: ({ children, ...props }) => (
    <h1
      className="mt-6 mb-4 scroll-m-20 font-bold text-xl tracking-tight"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="mt-6 mb-3 scroll-m-20 font-semibold text-lg tracking-tight"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="mt-5 mb-2 scroll-m-20 font-semibold text-base tracking-tight"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4
      className="mt-4 mb-2 scroll-m-20 font-semibold text-sm tracking-tight"
      {...props}
    >
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5
      className="mt-3 mb-1 scroll-m-20 font-semibold text-xs tracking-tight"
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6
      className="mt-3 mb-1 scroll-m-20 font-semibold text-xs tracking-tight"
      {...props}
    >
      {children}
    </h6>
  ),
  // Paragraph with proper spacing
  p: ({ children, ...props }) => (
    <p
      className="break-words text-sm leading-7 [&:not(:first-child)]:mt-3"
      {...props}
    >
      {children}
    </p>
  ),
  // List components
  ul: ({ className, children, ...props }) => (
    <ul className={cn("my-3 ml-6 list-disc [&>li]:mt-1", className)} {...props}>
      {children}
    </ul>
  ),
  ol: ({ className, children, ...props }) => (
    <ol
      className={cn("my-3 ml-6 list-decimal [&>li]:mt-1", className)}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ className, children, ...props }) => (
    <li className={cn("break-words text-sm leading-7", className)} {...props}>
      {children}
    </li>
  ),
  // Horizontal rule
  hr: ({ ...props }) => <hr className="my-6 border-border" {...props} />,
};

export const Response = memo(
  ({ className, components, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      components={{
        ...customComponents,
        ...components,
      }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
