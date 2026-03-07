"use client";

import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import type { PostTransformEvent } from "@repo/console-providers";

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
    <div className="px-6 py-4 bg-muted/20 border-t border-border/40 space-y-4 text-sm">
      {/* Body */}
      {sourceEvent.body && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Body</p>
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed text-foreground/80">
            {sourceEvent.body.length > 1000
              ? sourceEvent.body.slice(0, 1000) + "…"
              : sourceEvent.body}
          </p>
        </div>
      )}

      {/* Actor */}
      {sourceEvent.actor && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Actor</p>
          <div className="flex items-center gap-2">
            {sourceEvent.actor.avatarUrl && (
              <Image
                src={sourceEvent.actor.avatarUrl}
                alt={sourceEvent.actor.name}
                width={20}
                height={20}
                className="rounded-full"
                unoptimized
              />
            )}
            <span>{sourceEvent.actor.name}</span>
            {sourceEvent.actor.email && (
              <span className="text-muted-foreground">{sourceEvent.actor.email}</span>
            )}
          </div>
        </div>
      )}

      {/* References */}
      {sourceEvent.references.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">References</p>
          <div className="flex flex-wrap gap-1.5">
            {sourceEvent.references.map((ref, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted border border-border/60"
              >
                <span className="text-muted-foreground capitalize">{ref.type}</span>
                {ref.url ? (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-mono"
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
        if (entries.length === 0) return null;
        return (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Metadata</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {entries.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-xs text-muted-foreground truncate">{key}</dt>
                <dd className="text-xs font-mono truncate">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
        );
      })()}

      {/* Timestamps & IDs */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-border/40">
        <div className="text-xs text-muted-foreground">Event time</div>
        <div className="text-xs font-mono">
          {formatDistanceToNow(new Date(sourceEvent.occurredAt), { addSuffix: true })}
        </div>
        <div className="text-xs text-muted-foreground">Received</div>
        <div className="text-xs font-mono">
          {formatDistanceToNow(new Date(receivedAt), { addSuffix: true })}
        </div>
        <div className="text-xs text-muted-foreground">Stored</div>
        <div className="text-xs font-mono">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </div>
        <div className="text-xs text-muted-foreground">Source ID</div>
        <div className="text-xs font-mono truncate">{sourceEvent.sourceId}</div>
        <div className="text-xs text-muted-foreground">Ingestion</div>
        <div className="text-xs font-mono">{ingestionSource}</div>
      </div>
    </div>
  );
}
