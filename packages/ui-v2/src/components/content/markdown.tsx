import { cn } from "@repo/ui-v2/lib/utils";
import {
  type AnchorHTMLAttributes,
  type BlockquoteHTMLAttributes,
  type HTMLAttributes,
  isValidElement,
  type LiHTMLAttributes,
  type OlHTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

export const markdownComponents = {
  a({
    href,
    children,
    className,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const isExternal = href?.startsWith("http");

    return (
      <a
        className={cn(
          "wrap-anywhere relative text-foreground underline decoration-1 underline-offset-4 transition-colors duration-250 hover:text-muted-foreground",
          className
        )}
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
  blockquote({
    children,
    className,
    ...props
  }: BlockquoteHTMLAttributes<HTMLQuoteElement>) {
    return (
      <blockquote
        className={cn(
          "my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic",
          className
        )}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  code({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
    return (
      <code
        className={cn(
          "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  },
  em({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
    return (
      <em className={cn("italic", className)} {...props}>
        {children}
      </em>
    );
  },
  h1({
    children,
    className,
    id,
    ...props
  }: HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h1
        className={cn(
          "not-first:mt-16 max-w-2xl scroll-m-28 font-medium text-3xl leading-tight tracking-normal first:mt-0 lg:text-4xl",
          className
        )}
        id={id ?? slugifyHeading(children)}
        {...props}
      >
        {children}
      </h1>
    );
  },
  h2({
    children,
    className,
    id,
    ...props
  }: HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h2
        className={cn(
          "not-first:mt-16 max-w-2xl scroll-m-28 font-medium text-2xl leading-8 tracking-normal first:mt-0 lg:text-3xl lg:leading-10",
          className
        )}
        id={id ?? slugifyHeading(children)}
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3({
    children,
    className,
    id,
    ...props
  }: HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h3
        className={cn(
          "not-first:mt-16 max-w-2xl scroll-m-28 font-medium text-xl leading-7 tracking-normal lg:text-2xl lg:leading-8",
          className
        )}
        id={id ?? slugifyHeading(children)}
        {...props}
      >
        {children}
      </h3>
    );
  },
  hr({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
    return <hr className={cn("my-6 border-border", className)} {...props} />;
  },
  li({ children, className, ...props }: LiHTMLAttributes<HTMLLIElement>) {
    return (
      <li className={cn("mb-2 [&>p]:inline", className)} {...props}>
        {children}
      </li>
    );
  },
  ol({ children, className, ...props }: OlHTMLAttributes<HTMLOListElement>) {
    return (
      <ol
        className={cn(
          "not-first:mt-6 max-w-2xl list-decimal whitespace-normal ps-7 [li_&]:mt-2 [li_&]:list-[lower-alpha]",
          className
        )}
        {...props}
      >
        {children}
      </ol>
    );
  },
  p({ children, className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
    return (
      <p
        className={cn(
          "not-first:mt-6 max-w-2xl text-[17px] text-foreground leading-7 tracking-normal",
          className
        )}
        {...props}
      >
        {children}
      </p>
    );
  },
  strong({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
    return (
      <strong className={cn("font-semibold", className)} {...props}>
        {children}
      </strong>
    );
  },
  table({
    children,
    className,
    ...props
  }: TableHTMLAttributes<HTMLTableElement>) {
    return (
      <div className="not-first:mt-6 w-full max-w-2xl overflow-x-auto">
        <table
          className={cn(
            "w-full min-w-140 border-border border-y text-left text-sm leading-6",
            className
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },
  tbody({
    children,
    className,
    ...props
  }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
      <tbody className={cn("divide-y divide-border", className)} {...props}>
        {children}
      </tbody>
    );
  },
  td({
    children,
    className,
    ...props
  }: TdHTMLAttributes<HTMLTableCellElement>) {
    return (
      <td
        className={cn(
          "py-3 pr-6 align-top text-foreground text-sm leading-6 last:pr-0",
          className
        )}
        {...props}
      >
        {children}
      </td>
    );
  },
  th({
    children,
    className,
    ...props
  }: ThHTMLAttributes<HTMLTableCellElement>) {
    return (
      <th
        className={cn(
          "py-3 pr-6 text-left align-bottom font-medium text-muted-foreground text-sm leading-5 last:pr-0",
          className
        )}
        {...props}
      >
        {children}
      </th>
    );
  },
  thead({
    children,
    className,
    ...props
  }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
      <thead className={cn("border-border border-b", className)} {...props}>
        {children}
      </thead>
    );
  },
  tr({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
    return (
      <tr className={cn("border-border", className)} {...props}>
        {children}
      </tr>
    );
  },
  ul({ children, className, ...props }: HTMLAttributes<HTMLUListElement>) {
    return (
      <ul
        className={cn(
          "not-first:mt-6 max-w-2xl list-disc whitespace-normal ps-7 marker:text-inherit [li_&]:mt-2 [li_&]:list-[circle]",
          className
        )}
        {...props}
      >
        {children}
      </ul>
    );
  },
};

export type MarkdownComponents = typeof markdownComponents;
export type MarkdownComponentOverrides = Partial<MarkdownComponents>;

export function createMarkdownComponents(
  overrides: MarkdownComponentOverrides = {}
): MarkdownComponents {
  return {
    ...markdownComponents,
    ...overrides,
  };
}

function slugifyHeading(children: ReactNode): string {
  return flattenText(children)
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function flattenText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return flattenText(node.props.children);
  }

  return "";
}
