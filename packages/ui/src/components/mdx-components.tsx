import type { Components } from "react-markdown";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "../lib/utils";

// Use proper typing for the code component's props
interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any; // For other props that might be passed
}

const components: Partial<Components> = {
  // For inline code, we use the code component
  code({ className, children, ...props }: CodeProps) {
    // This will only be called for inline code with `code`, not code blocks (which use pre > code)
    return (
      <code
        className={cn(
          "not-prose",
          "bg-muted rounded-md px-1 py-0.5 text-xs",
          className,
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  // For code blocks, we use the pre component which wraps the code element
  pre({ children, className, ...props }: CodeProps) {
    // This will be called for code blocks (```code```)
    return (
      <div className="not-prose flex flex-col">
        <pre
          className={cn(
            "text-foreground dark:bg-muted/20 w-full overflow-x-auto rounded-md p-2 text-xs",
            className,
          )}
          {...props}
        >
          {children}
        </pre>
      </div>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      <a
        className="text-blue-500 hover:underline"
        target="_blank"
        rel="noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-foreground my-4 text-xl font-semibold" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-foreground my-4 text-lg font-semibold" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-foreground my-4 text-base font-semibold" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-foreground my-1 text-sm font-semibold" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-foreground my-1 text-xs font-semibold" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6
        className="text-foreground my-1 text-[0.65rem] font-semibold"
        {...props}
      >
        {children}
      </h6>
    );
  },
  p: ({ children }) => <p className="text-foreground text-xs">{children}</p>,
  ul: ({ className, ...props }) => (
    <ul className={cn("ml-4 list-disc", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("ml-4 list-decimal", className)} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("text-foreground mt-3 text-xs", className)} {...props} />
  ),
  hr: ({ ...props }) => <hr className="my-4 md:my-8" {...props} />,
};

const remarkPlugins = [remarkGfm];

const NonMemoizedMdx = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Mdx = memo(
  NonMemoizedMdx,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
