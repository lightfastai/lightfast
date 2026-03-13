"use client";

import type { PostTransformEvent } from "@repo/console-providers";
import { formatDistanceToNow } from "date-fns";

interface EventDetailProps {
  event: {
    id: number;
    sourceEvent: PostTransformEvent;
    ingestionSource: string;
    receivedAt: string;
    createdAt: string;
  };
}

export function EventDetail({ event }: EventDetailProps) {
  const { sourceEvent, ingestionSource, receivedAt, createdAt } = event;

  return (
    <div className="space-y-4 border-border/40 border-t bg-muted/20 px-6 py-4 text-sm">
      {/* Body */}
      {sourceEvent.body && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Body
          </p>
          <p className="whitespace-pre-wrap break-words text-foreground/80 text-sm leading-relaxed">
            {sourceEvent.body.length > 1000
              ? `${sourceEvent.body.slice(0, 1000)}…`
              : sourceEvent.body}
          </p>
        </div>
      )}

      {/* References */}
      {sourceEvent.references.length > 0 && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            References
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sourceEvent.references.map((ref, i) => (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted px-2 py-0.5 text-xs"
                key={i}
              >
                <span className="text-muted-foreground capitalize">
                  {ref.type}
                </span>
                {ref.url ? (
                  <a
                    className="font-mono text-primary hover:underline"
                    href={ref.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {ref.label ?? ref.id}
                  </a>
                ) : (
                  <span className="font-mono">{ref.label ?? ref.id}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {(() => {
        const entries = Object.entries(sourceEvent.metadata);
        if (entries.length === 0) {
          return null;
        }
        return (
          <div>
            <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Metadata
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {entries.map(([key, value]) => (
                <div className="contents" key={key}>
                  <dt className="truncate text-muted-foreground text-xs">
                    {key}
                  </dt>
                  <dd className="truncate font-mono text-xs">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })()}

      {/* Timestamps & IDs */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-border/40 border-t pt-1">
        <div className="text-muted-foreground text-xs">Event time</div>
        <div className="font-mono text-xs">
          {formatDistanceToNow(new Date(sourceEvent.occurredAt), {
            addSuffix: true,
          })}
        </div>
        <div className="text-muted-foreground text-xs">Received</div>
        <div className="font-mono text-xs">
          {formatDistanceToNow(new Date(receivedAt), { addSuffix: true })}
        </div>
        <div className="text-muted-foreground text-xs">Stored</div>
        <div className="font-mono text-xs">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </div>
        <div className="text-muted-foreground text-xs">Source ID</div>
        <div className="truncate font-mono text-xs">{sourceEvent.sourceId}</div>
        <div className="text-muted-foreground text-xs">Ingestion</div>
        <div className="font-mono text-xs">{ingestionSource}</div>
      </div>
    </div>
  );
}
