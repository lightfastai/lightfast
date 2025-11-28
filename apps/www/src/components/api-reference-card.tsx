"use client";

import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { ApiMethod } from "./api-method";

interface ApiReferenceCardProps {
  title: string;
  description: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  href: string;
  className?: string;
}

export function ApiReferenceCard({
  title,
  description,
  method,
  path,
  href,
  className,
}: ApiReferenceCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-4 transition-all hover:border-foreground/20 hover:bg-muted/30 hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
          {title}
        </h3>
        <ApiMethod method={method} />
      </div>
      <code className="text-xs text-muted-foreground font-mono">{path}</code>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {description}
      </p>
    </Link>
  );
}

interface ApiReferenceGridProps {
  children: React.ReactNode;
  className?: string;
}

export function ApiReferenceGrid({ children, className }: ApiReferenceGridProps) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {children}
    </div>
  );
}