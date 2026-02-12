import { cn } from "@repo/ui/lib/utils";
import type React from "react";
import { isValidElement, Children } from "react";
import Image from "next/image";
import Link from "next/link";
import { Info, ExternalLink } from "lucide-react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
import {
  Accordion as AccordionRoot,
  AccordionContent as AccordionContentRoot,
  AccordionItem as AccordionItemRoot,
  AccordionTrigger as AccordionTriggerRoot,
} from "@repo/ui/components/ui/accordion";
import { FeatureList } from "@/src/components/feature-list";
import { ApiEndpoint } from "@/src/components/api-endpoint";
import { ApiMethod } from "@/src/components/api-method";
import {
  ApiReferenceCard,
  ApiReferenceGrid,
} from "@/src/components/api-reference-card";
import {
  ValidationError,
  ValidationErrorList,
  ValidationExample,
} from "@/src/components/validation-error";
import { APIPage } from "fumadocs-openapi/ui";
import { authUrl, wwwUrl } from "@/src/lib/related-projects";
import { NextSteps } from "@/src/components/next-steps";

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
  async code({ inline, className, children, ...props }: CodeComponentProps) {
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

    // Block code - use SSRCodeBlock for syntax highlighting
    const langMatch = className?.match(/language-(\w+)/);
    if (langMatch && typeof children === "string") {
      const language = langMatch[1];
      return SSRCodeBlock({
        children,
        language,
        className: "my-6",
      });
    }

    // Fallback for block code without language
    return (
      <code className={cn("font-mono", className)} {...props}>
        {children}
      </code>
    );
  },

  // Pre component for code blocks - uses SSR syntax highlighting
  async pre({ children, className, ...props }: MarkdownComponentProps) {
    // Check if children is a code element with language class
    const child = Children.only(children);
    if (isValidElement(child) && child.type === "code") {
      const codeProps = child.props as {
        className?: string;
        children?: React.ReactNode;
      };
      const langMatch = codeProps.className?.match(/language-(\w+)/);

      if (langMatch && typeof codeProps.children === "string") {
        const language = langMatch[1];
        const codeContent = codeProps.children;

        // Call SSRCodeBlock as async function
        const highlighted = await SSRCodeBlock({
          children: codeContent,
          language,
          className: "my-6",
        });
        return highlighted;
      }
    }

    // Fallback - just pass through children (SSRCodeBlock handles its own styling)
    return (
      <pre className={cn("my-6 text-sm", className)} {...props}>
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
        className="text-inherit underline underline-offset-2 decoration-foreground/40 hover:decoration-foreground transition-colors"
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

  // Table components - minimal styling matching Alert aesthetic
  table({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <div className="my-10 w-full overflow-x-auto rounded-xs bg-card border border-transparent">
        <table className={cn("w-full border-collapse", className)} {...props}>
          {children}
        </table>
      </div>
    );
  },

  thead({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <thead className={cn("border-b border-border/50", className)} {...props}>
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
          "border-b border-border/30 transition-colors hover:bg-muted/30",
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
          "text-xs h-10 px-4 text-left align-middle font-semibold [&:has([role=checkbox])]:pr-0 break-words",
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
          "text-xs p-4 align-middle [&:has([role=checkbox])]:pr-0 break-words",
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
          "bg-card border border-transparent p-6 rounded-xs my-10 [&_*]:text-sm [&_p]:leading-relaxed [&_p]:mt-0 flex gap-3",
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
  ApiReferenceCard,
  ApiReferenceGrid,
  APIPage,

  // Validation components
  ValidationError,
  ValidationErrorList,
  ValidationExample,

  // Fumadocs UI components
  Tab,
  Tabs,

  // Next Steps component
  NextSteps,

  // FAQ accordion components for docs
  FAQAccordion({
    children,
    defaultValue,
  }: {
    children: React.ReactNode;
    defaultValue?: string;
  }) {
    return (
      <div className="my-8">
        <AccordionRoot
          type="single"
          collapsible
          defaultValue={defaultValue}
          className="w-full"
        >
          {children}
        </AccordionRoot>
      </div>
    );
  },

  FAQItem({
    value,
    question,
    children,
  }: {
    value: string;
    question: string;
    children: React.ReactNode;
  }) {
    return (
      <AccordionItemRoot
        value={value}
        className="border-b border-border last:border-b-0"
      >
        <AccordionTriggerRoot
          className={cn(
            "flex justify-between items-center w-full py-6 text-left",
            "hover:no-underline group",
          )}
        >
          <span className="text-base font-medium text-foreground pr-4">
            {question}
          </span>
        </AccordionTriggerRoot>
        <AccordionContentRoot className="pb-6 pr-12">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {children}
          </p>
        </AccordionContentRoot>
      </AccordionItemRoot>
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
          "text-inherit underline underline-offset-2 decoration-foreground/40 hover:decoration-foreground transition-colors",
          className,
        )}
        {...props}
      >
        {children}
        {external && (
          <>
            {" "}
            <ExternalLink className="inline-block w-3 h-3 align-baseline" />
          </>
        )}
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
          "text-inherit underline underline-offset-2 decoration-foreground/40 hover:decoration-foreground transition-colors",
          className,
        )}
        {...props}
      >
        {children}
        {external && (
          <>
            {" "}
            <ExternalLink className="inline-block w-3 h-3 align-baseline" />
          </>
        )}
      </Link>
    );
  },
};
