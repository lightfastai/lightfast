import { cn } from "@repo/ui/lib/utils";
import type React from "react";
import Image from "next/image";
import Link from "next/link";
import { Info, ExternalLink } from "lucide-react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { FeatureList } from "@/src/components/feature-list";
import { ApiEndpoint } from "@/src/components/api-endpoint";
import { ApiMethod } from "@/src/components/api-method";
import { CodeBlock } from "@/src/components/code-block";
import {
  ApiReferenceCard,
  ApiReferenceGrid,
} from "@/src/components/api-reference-card";
import { CodeEditor as CodeEditorBase } from "@/src/components/code-editor";
import { APIPage } from "fumadocs-openapi/ui";
import { authUrl, wwwUrl } from "@/src/lib/related-projects";

// Properly typed component props based on react-markdown's actual types
type MarkdownComponentProps = React.HTMLAttributes<HTMLElement> & {
  node?: unknown;
  children?: React.ReactNode;
};

// Code component specific props
interface CodeComponentProps extends MarkdownComponentProps {
  inline?: boolean;
}

export const mdxComponents = {
  // Spread Fumadocs default components first (includes Next.js Image-optimized img)
  ...defaultMdxComponents,

  // Custom overrides below

  // Default img tag
  img({
    src,
    alt,
    className,
    ...props
  }: MarkdownComponentProps & {
    src?: string;
    alt?: string;
  }) {
    if (!src) return null;

    return (
      <img
        src={src}
        alt={alt ?? ""}
        className={cn(
          "my-6 rounded-sm border border-border shadow-sm",
          "w-full max-h-[400px] object-cover",
          className,
        )}
        {...props}
      />
    );
  },

  // Code components - handles both inline and block code
  code({ inline, className, children, ...props }: CodeComponentProps) {
    // Inline code styling
    if (inline) {
      return (
        <code
          className={cn(
            "bg-muted/50 rounded-md px-1 py-0.5 text-sm font-mono",
            className,
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
    // Block code without syntax highlighting
    return (
      <code className={cn("font-mono text-sm", className)} {...props}>
        {children}
      </code>
    );
  },

  // Pre component for code blocks
  pre({ children, className, ...props }: MarkdownComponentProps) {
    return (
      <pre
        className={cn(
          "my-6 relative w-full rounded-md border border-border bg-muted/50 dark:bg-muted/20",
          "text-foreground p-4 text-sm font-mono leading-relaxed",
          "overflow-auto",
          className,
        )}
        {...props}
      >
        {children}
      </pre>
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

  // Link component - default <a> tag
  a({ href, children, ...props }: MarkdownComponentProps & { href?: string }) {
    const isExternal = href?.startsWith("http");
    return (
      <a
        href={href}
        className="text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground transition-colors"
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },

  // Heading components with consistent styling
  h1({ children, ...props }: MarkdownComponentProps) {
    return (
      <h1
        className="scroll-m-20 text-3xl font-bold tracking-tight mb-6 mt-12 first:mt-0"
        {...props}
      >
        {children}
      </h1>
    );
  },

  h2({ children, ...props }: MarkdownComponentProps) {
    return (
      <h2
        className="scroll-m-20 text-3xl font-semibold tracking-tight mb-5 mt-12"
        {...props}
      >
        {children}
      </h2>
    );
  },

  h3({ children, ...props }: MarkdownComponentProps) {
    return (
      <h3
        className="scroll-m-20 text-xl font-semibold tracking-tight mb-4 mt-8"
        {...props}
      >
        {children}
      </h3>
    );
  },

  h4({ children, ...props }: MarkdownComponentProps) {
    return (
      <h4
        className="scroll-m-20 text-lg font-semibold tracking-tight mb-3 mt-6"
        {...props}
      >
        {children}
      </h4>
    );
  },

  h5({ children, ...props }: MarkdownComponentProps) {
    return (
      <h5
        className="scroll-m-20 text-base font-semibold tracking-tight mb-2 mt-4"
        {...props}
      >
        {children}
      </h5>
    );
  },

  h6({ children, ...props }: MarkdownComponentProps) {
    return (
      <h6
        className="scroll-m-20 text-sm font-semibold tracking-tight mb-2 mt-4"
        {...props}
      >
        {children}
      </h6>
    );
  },

  // Paragraph with proper spacing
  p({ children, ...props }: MarkdownComponentProps) {
    return (
      <p
        className="text-base leading-7 [&:not(:first-child)]:mt-6 break-words"
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
        className={cn("my-3 ml-6 list-disc [&>li]:mt-2", className)}
        {...props}
      >
        {children}
      </ul>
    );
  },

  ol({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <ol
        className={cn("my-6 ml-6 list-decimal [&>li]:mt-2", className)}
        {...props}
      >
        {children}
      </ol>
    );
  },

  li({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <li
        className={cn("text-base leading-7 break-words", className)}
        {...props}
      >
        {children}
      </li>
    );
  },

  // Horizontal rule
  hr({ ...props }: MarkdownComponentProps) {
    return <hr className="my-12 border-border" {...props} />;
  },

  // Blockquote
  blockquote({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <blockquote
        className={cn(
          "text-base my-6 border-l-4 border-border pl-6 italic text-muted-foreground",
          className,
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
      <div className="my-6 w-full overflow-y-auto">
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
          className,
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
          "text-base h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 break-words",
          className,
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
          "text-base p-2 align-middle [&:has([role=checkbox])]:pr-0 break-words",
          className,
        )}
        {...props}
      >
        {children}
      </td>
    );
  },

  // Alert component for callouts
  Alert({ children, className, ...props }: MarkdownComponentProps) {
    return (
      <div
        className={cn(
          "bg-card border border-transparent p-6 rounded-xs my-10 [&_*]:text-xs [&_p]:leading-relaxed [&_p]:mt-0 flex gap-3",
          className,
        )}
        {...props}
      >
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1">{children}</div>
      </div>
    );
  },

  // Custom components
  FeatureList,
  ApiEndpoint,
  ApiMethod,
  CodeBlock,
  ApiReferenceCard,
  ApiReferenceGrid,
  APIPage,

  // Fumadocs UI components
  Tab,
  Tabs,

  // CodeEditor with consistent spacing
  CodeEditor({
    code,
    language,
    className,
    showHeader,
    ...props
  }: {
    code: string;
    language: string;
    className?: string;
    showHeader?: boolean;
  }) {
    return (
      <div className="my-10">
        <CodeEditorBase
          code={code}
          language={language}
          className={className}
          showHeader={showHeader}
          {...props}
        />
      </div>
    );
  },

  // Next.js optimized components (use explicitly in MDX)
  NextLink({
    href,
    children,
    className,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <Link
        href={href}
        prefetch
        className={cn(
          "text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground transition-colors",
          className,
        )}
        {...props}
      >
        {children}
      </Link>
    );
  },

  NextImage({
    src,
    alt,
    width,
    height,
    className,
    priority = false,
    ...props
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean;
  }) {
    return (
      <Image
        src={src}
        alt={alt}
        width={width ?? 700}
        height={height ?? 400}
        priority={priority}
        quality={40}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
        className={cn(
          "my-6 rounded-sm border border-border shadow-sm",
          "w-full max-h-[400px] object-cover",
          className,
        )}
        {...props}
      />
    );
  },

  // Auth app link - dynamically routes to auth app (localhost:4102 in dev, lightfast.ai in prod)
  AuthLink({
    path,
    children,
    className,
    external = false,
    ...props
  }: {
    path: string;
    children: React.ReactNode;
    className?: string;
    external?: boolean;
  }) {
    const href = `${authUrl}${path.startsWith("/") ? path : `/${path}`}`;
    return (
      <Link
        href={href}
        prefetch={!external}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cn(
          "text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground transition-colors inline-flex items-center gap-1",
          className,
        )}
        {...props}
      >
        {children}
        {external && <ExternalLink className="w-3 h-3" />}
      </Link>
    );
  },

  // Www app link - dynamically routes to www app (localhost:4101 in dev, lightfast.ai in prod)
  WwwLink({
    path,
    children,
    className,
    external = false,
    ...props
  }: {
    path: string;
    children: React.ReactNode;
    className?: string;
    external?: boolean;
  }) {
    const href = `${wwwUrl}${path.startsWith("/") ? path : `/${path}`}`;
    return (
      <Link
        href={href}
        prefetch={!external}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={cn(
          "text-foreground underline underline-offset-4 decoration-foreground/40 hover:decoration-foreground transition-colors inline-flex items-center gap-1",
          className,
        )}
        {...props}
      >
        {children}
        {external && <ExternalLink className="w-3 h-3" />}
      </Link>
    );
  },
};
