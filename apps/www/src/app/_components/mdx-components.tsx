import { createMarkdownComponents } from "@repo/ui-v2/components/content/markdown";
import type { Route } from "next";
import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

export const markdownComponents = createMarkdownComponents({
  a({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) {
    const isExternal = href?.startsWith("http");
    const isInternalRoute = href?.startsWith("/") && !href.startsWith("//");

    if (href && isInternalRoute) {
      return (
        <Link
          className="text-foreground underline underline-offset-4 transition-colors hover:text-muted-foreground"
          href={href as Route}
          {...props}
        >
          {children}
        </Link>
      );
    }

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
});
