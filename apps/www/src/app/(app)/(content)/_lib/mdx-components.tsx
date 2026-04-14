import { SSRCodeBlock } from "@repo/ui/components/ssr-code-block";
import {
  AccordionContent as AccordionContentRoot,
  AccordionItem as AccordionItemRoot,
  Accordion as AccordionRoot,
  AccordionTrigger as AccordionTriggerRoot,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Info } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { Children, isValidElement } from "react";
import { AlphaBanner } from "~/app/(app)/(content)/docs/_components/alpha-banner";
import { ApiEndpoint } from "~/app/(app)/(content)/docs/_components/api-endpoint";
import { ApiMethod } from "~/app/(app)/(content)/docs/_components/api-method";
import {
  ApiReferenceCard,
  ApiReferenceGrid,
} from "~/app/(app)/(content)/docs/_components/api-reference-card";
import { FeatureList } from "~/app/(app)/(content)/docs/_components/feature-list";
import { NextSteps } from "~/app/(app)/(content)/docs/_components/next-steps";
import { EmbeddedOperation } from "~/app/(app)/(content)/docs/_components/schema/embedded-operation";
import {
  ValidationError,
  ValidationErrorList,
  ValidationExample,
} from "~/app/(app)/(content)/docs/_components/validation-error";
import {
  IntegrationFeature,
  IntegrationFeatureGrid,
} from "~/app/(app)/(marketing)/(content)/integrations/_components/integration-feature-grid";
import { IntegrationScreenshot } from "~/app/(app)/(marketing)/(content)/integrations/_components/integration-screenshot";

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
  }: MarkdownComponentProps & {
    src?: string;
    alt?: string;
  }) {
    if (!src) {
      return null;
    }

    return (
      <Image
        alt={alt ?? ""}
        className={cn(
          "my-6 aspect-video rounded-lg",
          "h-auto w-full object-fill",
          className
        )}
        height={0}
        sizes="100vw"
        src={src}
        width={0}
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
            "rounded-md bg-muted/50 px-1 py-0.5 font-mono",
            className
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

    // Fallback: no language class (inline code that fumadocs doesn't mark with inline prop)
    return (
      <code
        className={cn(
          "rounded-md bg-muted/50 px-1 py-0.5 font-mono",
          className
        )}
        {...props}
      >
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
        className="text-inherit underline decoration-foreground/40 underline-offset-2 transition-colors hover:decoration-foreground"
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
  h1({ children, ...props }: MarkdownComponentProps) {
    return (
      <h1
        className="mt-12 mb-6 scroll-m-20 font-bold text-3xl tracking-tight first:mt-0"
        {...props}
      >
        {children}
      </h1>
    );
  },

  h2({ children, ...props }: MarkdownComponentProps) {
    return (
      <h2
        className="mt-12 scroll-m-20 font-pp font-semibold text-2xl"
        {...props}
      >
        {children}
      </h2>
    );
  },

  h3({ children, ...props }: MarkdownComponentProps) {
    return (
      <h3
        className="mt-8 mb-4 scroll-m-20 font-semibold text-xl tracking-tight"
        {...props}
      >
        {children}
      </h3>
    );
  },

  h4({ children, ...props }: MarkdownComponentProps) {
    return (
      <h4
        className="mt-6 mb-3 scroll-m-20 font-semibold text-lg tracking-tight"
        {...props}
      >
        {children}
      </h4>
    );
  },

  h5({ children, ...props }: MarkdownComponentProps) {
    return (
      <h5
        className="mt-4 mb-2 scroll-m-20 font-semibold text-base tracking-tight"
        {...props}
      >
        {children}
      </h5>
    );
  },

  h6({ children, ...props }: MarkdownComponentProps) {
    return (
      <h6
        className="mt-4 mb-2 scroll-m-20 font-semibold text-sm tracking-tight"
        {...props}
      >
        {children}
      </h6>
    );
  },

  // Paragraph with proper spacing
  p({ children, ...props }: MarkdownComponentProps) {
    return (
      <p className="break-words text-md [&:not(:first-child)]:mt-6" {...props}>
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
      <li className={cn("break-words text-md", className)} {...props}>
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
          "my-6 border-border border-l-4 pl-6 text-base text-muted-foreground italic",
          className
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
      <div className="my-10 w-full overflow-x-auto rounded-xs border border-transparent bg-card">
        <table className={cn("w-full border-collapse", className)} {...props}>
          {children}
        </table>
      </div>
    );
  },

  thead({ className, children, ...props }: MarkdownComponentProps) {
    return (
      <thead className={cn("border-border/50 border-b", className)} {...props}>
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
          "border-border/30 border-b transition-colors hover:bg-muted/30",
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
          "h-10 break-words px-4 text-left align-middle font-semibold text-sm [&:has([role=checkbox])]:pr-0",
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
          "break-words p-4 align-middle text-sm [&:has([role=checkbox])]:pr-0",
          className
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
          "my-10 flex gap-3 rounded-xs border border-transparent bg-card p-6 [&_*]:text-sm [&_p]:mt-0 [&_p]:leading-relaxed",
          className
        )}
        {...props}
      >
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="flex-1">{children}</div>
      </div>
    );
  },

  // Integration components
  IntegrationFeatureGrid,
  IntegrationFeature,
  IntegrationScreenshot,

  // Custom components
  FeatureList,
  ApiEndpoint,
  ApiMethod,
  ApiReferenceCard,
  ApiReferenceGrid,
  AlphaBanner,

  // Validation components
  ValidationError,
  ValidationErrorList,
  ValidationExample,

  // Schema components
  EmbeddedOperation,

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
          className="w-full"
          collapsible
          defaultValue={defaultValue}
          type="single"
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
        className="border-border border-b last:border-b-0"
        value={value}
      >
        <AccordionTriggerRoot
          className={cn(
            "flex w-full items-center justify-between py-6 text-left",
            "group hover:no-underline"
          )}
        >
          <span className="pr-4 font-medium text-base text-foreground">
            {question}
          </span>
        </AccordionTriggerRoot>
        <AccordionContentRoot className="pr-12 pb-6">
          <p className="text-muted-foreground text-sm leading-relaxed">
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
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <Link
        className={cn(
          "text-foreground underline decoration-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground",
          className
        )}
        href={href as Route}
        prefetch
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
        alt={alt}
        className={cn(
          "my-6 rounded-xl border border-border/50 shadow-sm",
          "w-full object-cover",
          className
        )}
        height={height ?? 400}
        priority={priority}
        quality={40}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
        src={src}
        width={width ?? 700}
        {...props}
      />
    );
  },
};
