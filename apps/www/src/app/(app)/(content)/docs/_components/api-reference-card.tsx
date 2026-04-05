import { cn } from "@repo/ui/lib/utils";
import { ApiMethod } from "~/app/(app)/(content)/docs/_components/api-method";
import { ContentLink } from "~/components/content-link";

interface ApiReferenceCardProps {
  className?: string;
  description: string;
  href: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  title: string;
}

export function ApiReferenceCard({
  description,
  method,
  path,
  href,
  className,
}: ApiReferenceCardProps) {
  return (
    <ContentLink
      className={cn(
        "group flex flex-col gap-1.5 border-border/20 border-b py-4 transition-colors hover:text-foreground",
        className
      )}
      href={href}
    >
      <div className="flex items-center gap-3">
        <ApiMethod method={method} />
        <code className="font-mono text-muted-foreground text-sm group-hover:text-foreground">
          {path}
        </code>
      </div>
      <p className="line-clamp-2 text-muted-foreground text-sm">
        {description}
      </p>
    </ContentLink>
  );
}

interface ApiReferenceGridProps {
  children: React.ReactNode;
  className?: string;
}

export function ApiReferenceGrid({
  children,
  className,
}: ApiReferenceGridProps) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}
