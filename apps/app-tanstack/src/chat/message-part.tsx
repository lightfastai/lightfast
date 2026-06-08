import { Badge } from "@repo/ui/components/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { UIMessage } from "@vendor/ai";
import { ChevronDown, Wrench } from "lucide-react";
import { memo } from "react";

type ToolPart = UIMessage["parts"][number] & {
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state: string;
  toolName?: string;
};

export const WorkspaceAssistantMessagePart = memo(
  function WorkspaceAssistantMessagePart({
    isStreaming,
    part,
  }: {
    isStreaming: boolean;
    part: UIMessage["parts"][number];
  }) {
    if (part.type === "text") {
      return <div className="whitespace-pre-wrap">{part.text}</div>;
    }

    if (part.type === "reasoning") {
      return (
        <details
          className="rounded-sm border border-border/60 bg-muted/20 p-3 text-sm"
          open={isStreaming}
        >
          <summary className="cursor-pointer font-medium text-muted-foreground">
            Reasoning
          </summary>
          <div className="mt-3 whitespace-pre-wrap text-muted-foreground">
            {part.text}
          </div>
        </details>
      );
    }

    if (isToolPart(part)) {
      const toolName =
        part.type === "dynamic-tool"
          ? part.toolName
          : part.type.split("-").slice(1).join("-");
      return (
        <details
          className="rounded-sm border border-border/60 bg-muted/20 text-sm"
          open={part.state !== "output-available"}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
            <span className="flex min-w-0 items-center gap-2">
              <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{toolName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge className="rounded-full text-xs" variant="secondary">
                {formatPartLabel(part.state)}
              </Badge>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </span>
          </summary>
          <div className="space-y-3 border-border/60 border-t p-3">
            <ToolPayload label="Input" value={part.input} />
            {part.errorText ? (
              <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                {part.errorText}
              </div>
            ) : (
              <ToolPayload label="Output" value={part.output} />
            )}
          </div>
        </details>
      );
    }

    if (part.type === "source-url") {
      const source = part as { title?: string; url?: string };
      if (!source.url) {
        return null;
      }
      return (
        <a
          className="text-muted-foreground text-sm underline underline-offset-4"
          href={source.url}
          rel="noreferrer"
          target="_blank"
        >
          {source.title ?? source.url}
        </a>
      );
    }

    if (part.type === "source-document") {
      const source = part as { filename?: string; title?: string };
      return (
        <div className="text-muted-foreground text-sm">
          Source: {source.title ?? source.filename ?? "Document"}
        </div>
      );
    }

    if (part.type === "file") {
      const file = part as {
        filename?: string;
        mediaType?: string;
        url?: string;
      };
      const label = file.filename ?? file.mediaType ?? "File";
      if (file.url) {
        return (
          <a
            className="text-muted-foreground text-sm underline underline-offset-4"
            href={file.url}
            rel="noreferrer"
            target="_blank"
          >
            {label}
          </a>
        );
      }
      return <div className="text-muted-foreground text-sm">{label}</div>;
    }

    if (part.type === "step-start") {
      return null;
    }

    if (part.type.startsWith("data-")) {
      return (
        <div className="text-muted-foreground text-sm">
          {formatPartLabel(part.type.slice("data-".length))} data received
        </div>
      );
    }

    return (
      <div className="text-muted-foreground text-sm">
        {formatPartLabel(part.type)} received
      </div>
    );
  }
);

function isToolPart(part: UIMessage["parts"][number]): part is ToolPart {
  return (
    "state" in part &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function ToolPayload({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <div className="font-medium text-muted-foreground text-xs">{label}</div>
      <pre
        className={cn(
          "max-h-72 overflow-auto rounded-sm bg-background/80 p-3 text-xs",
          "whitespace-pre-wrap break-words"
        )}
      >
        {formatPayload(value)}
      </pre>
    </div>
  );
}

function formatPayload(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatPartLabel(value: string) {
  return value.split(/[-_]/g).filter(Boolean).join(" ");
}
