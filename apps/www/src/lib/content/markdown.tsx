import {
  isValidElement,
  type AnchorHTMLAttributes,
  type BlockquoteHTMLAttributes,
  type HTMLAttributes,
  type LiHTMLAttributes,
  type OlHTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

import { cn } from "@repo/ui-v2/lib/utils";

export const markdownComponents = {
  a({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const isExternal = href?.startsWith("http");

    return (
      <a
        className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
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
    ...props
  }: BlockquoteHTMLAttributes<HTMLQuoteElement>) {
    return (
      <blockquote
        className="my-10 border-border border-l-2 pl-6 text-muted-foreground text-xl leading-8"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  code({ children, ...props }: HTMLAttributes<HTMLElement>) {
    return (
      <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono" {...props}>
        {children}
      </code>
    );
  },
  em({ children, ...props }: HTMLAttributes<HTMLElement>) {
    return (
      <em className="italic" {...props}>
        {children}
      </em>
    );
  },
  h1({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h1
        className="mb-8 scroll-m-28 font-medium text-4xl leading-tight tracking-normal"
        id={id ?? slugifyHeading(children)}
        {...props}
      >
        {children}
      </h1>
    );
  },
  h2({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h2
        className="mt-16 mb-6 scroll-m-28 font-medium text-2xl leading-tight tracking-normal first:mt-0"
        id={id ?? slugifyHeading(children)}
        {...props}
      >
        {children}
      </h2>
    );
  },
  h3({ children, id, ...props }: HTMLAttributes<HTMLHeadingElement>) {
    return (
      <h3
        className="mt-12 mb-5 scroll-m-28 font-medium text-xl leading-tight tracking-normal"
        id={id ?? slugifyHeading(children)}
        {...props}
      >
        {children}
      </h3>
    );
  },
  hr({ ...props }: HTMLAttributes<HTMLHRElement>) {
    return <hr className="my-12 border-border" {...props} />;
  },
  li({ children, ...props }: LiHTMLAttributes<HTMLLIElement>) {
    return (
      <li className="mt-2 leading-8" {...props}>
        {children}
      </li>
    );
  },
  ol({ children, ...props }: OlHTMLAttributes<HTMLOListElement>) {
    return (
      <ol className="my-8 ml-6 list-decimal text-base leading-8" {...props}>
        {children}
      </ol>
    );
  },
  p({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
    return (
      <p
        className="max-w-[72ch] text-base leading-8 text-foreground [&:not(:first-child)]:mt-5"
        {...props}
      >
        {children}
      </p>
    );
  },
  strong({ children, ...props }: HTMLAttributes<HTMLElement>) {
    return (
      <strong className="font-medium" {...props}>
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
      <div className="my-10 w-full overflow-x-auto border-border border-y">
        <table className={cn("w-full border-collapse", className)} {...props}>
          {children}
        </table>
      </div>
    );
  },
  tbody({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody {...props}>{children}</tbody>;
  },
  td({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
    return (
      <td className="border-border/60 border-t px-4 py-3 text-sm" {...props}>
        {children}
      </td>
    );
  },
  th({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
    return (
      <th
        className="px-4 py-3 text-left font-medium text-muted-foreground text-sm"
        {...props}
      >
        {children}
      </th>
    );
  },
  thead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return (
      <thead className="border-border border-b" {...props}>
        {children}
      </thead>
    );
  },
  tr({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
    return <tr {...props}>{children}</tr>;
  },
  ul({ children, ...props }: HTMLAttributes<HTMLUListElement>) {
    return (
      <ul className="my-8 ml-6 list-disc text-base leading-8" {...props}>
        {children}
      </ul>
    );
  },
};

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
