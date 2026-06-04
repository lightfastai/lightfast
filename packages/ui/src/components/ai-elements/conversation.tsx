"use client";

import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { UIMessage } from "@vendor/ai";
import { ArrowDownIcon, DownloadIcon } from "lucide-react";
import type { ComponentProps, ReactNode, RefObject } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const STICK_TO_BOTTOM_THRESHOLD_PX = 70;

interface ConversationScrollState {
  isAtBottom: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  scrollToBottom: () => void;
}

const ConversationScrollContext = createContext<ConversationScrollState | null>(
  null
);

function useConversationScroll(): ConversationScrollState {
  const ctx = useContext(ConversationScrollContext);
  if (!ctx) {
    throw new Error(
      "Conversation components must be used within <Conversation>"
    );
  }
  return ctx;
}

export type ConversationProps = ComponentProps<"div"> & {
  "aria-label"?: string;
};

export const Conversation = ({
  "aria-label": ariaLabel,
  className,
  children,
  ...props
}: ConversationProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsAtBottom(distance <= STICK_TO_BOTTOM_THRESHOLD_PX);
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight });
  }, []);

  return (
    <ConversationScrollContext.Provider
      value={{ scrollRef, isAtBottom, scrollToBottom }}
    >
      <div
        aria-label={ariaLabel ?? "Conversation"}
        className={cn("relative flex-1 overflow-hidden", className)}
        role="log"
        {...props}
      >
        <div
          className="h-full overflow-y-auto"
          data-slot="conversation-scroller"
          onScroll={recompute}
          ref={scrollRef}
        >
          {children}
        </div>
      </div>
    </ConversationScrollContext.Provider>
  );
};

const DEFAULT_ESTIMATE_SIZE = 120;

export type ConversationContentProps<T> = Omit<
  ComponentProps<"div">,
  "children"
> & {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  estimateSize?: number;
};

export const ConversationContent = <T,>({
  className,
  items,
  renderItem,
  getItemKey,
  estimateSize = DEFAULT_ESTIMATE_SIZE,
  ...props
}: ConversationContentProps<T>) => {
  const { isAtBottom, scrollRef, scrollToBottom } = useConversationScroll();
  const previousItemCountRef = useRef(items.length);
  const previousTotalSizeRef = useRef(0);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    getItemKey: (index) => getItemKey(items[index] as T, index),
    // Native end-anchoring keeps the view pinned to the bottom while the last
    // row grows during streaming (virtual-core 3.16 options, surfaced through
    // react-virtual 3.13's VirtualizerOptions import).
    anchorTo: "end",
    followOnAppend: "smooth",
    scrollEndThreshold: STICK_TO_BOTTOM_THRESHOLD_PX,
  });
  const totalSize = virtualizer.getTotalSize();

  useLayoutEffect(() => {
    const previousItemCount = previousItemCountRef.current;
    const previousTotalSize = previousTotalSizeRef.current;
    previousItemCountRef.current = items.length;
    previousTotalSizeRef.current = totalSize;

    const grew =
      items.length > previousItemCount || totalSize > previousTotalSize;

    if (!(grew && isAtBottom)) {
      return;
    }

    scrollToBottom();
  }, [isAtBottom, items.length, scrollToBottom, totalSize]);

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ height: `${totalSize}px` }}
      {...props}
    >
      {virtualizer.getVirtualItems().map((virtualItem) => (
        <div
          className="absolute top-0 left-0 w-full"
          data-index={virtualItem.index}
          key={virtualItem.key}
          ref={virtualizer.measureElement}
          style={{ transform: `translateY(${virtualItem.start}px)` }}
        >
          {renderItem(items[virtualItem.index] as T, virtualItem.index)}
        </div>
      ))}
    </div>
  );
};

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

export const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = ({
  "aria-label": ariaLabel,
  className,
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useConversationScroll();

  if (isAtBottom) {
    return null;
  }

  return (
    <Button
      aria-label={ariaLabel ?? "Scroll to latest message"}
      className={cn(
        "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full dark:bg-background dark:hover:bg-muted",
        className
      )}
      onClick={scrollToBottom}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <ArrowDownIcon className="size-4" />
    </Button>
  );
};

const getMessageText = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

export type ConversationDownloadProps = Omit<
  ComponentProps<typeof Button>,
  "onClick"
> & {
  messages: UIMessage[];
  filename?: string;
  formatMessage?: (message: UIMessage, index: number) => string;
};

const defaultFormatMessage = (message: UIMessage): string => {
  const roleLabel =
    message.role.charAt(0).toUpperCase() + message.role.slice(1);
  return `**${roleLabel}:** ${getMessageText(message)}`;
};

export const messagesToMarkdown = (
  messages: UIMessage[],
  formatMessage: (
    message: UIMessage,
    index: number
  ) => string = defaultFormatMessage
): string => messages.map((msg, i) => formatMessage(msg, i)).join("\n\n");

export const ConversationDownload = ({
  messages,
  filename = "conversation.md",
  formatMessage = defaultFormatMessage,
  "aria-label": ariaLabel,
  className,
  children,
  ...props
}: ConversationDownloadProps) => {
  const handleDownload = useCallback(() => {
    const markdown = messagesToMarkdown(messages, formatMessage);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }, [messages, filename, formatMessage]);

  return (
    <Button
      aria-label={ariaLabel ?? "Download conversation"}
      className={cn(
        "absolute top-4 right-4 rounded-full dark:bg-background dark:hover:bg-muted",
        className
      )}
      onClick={handleDownload}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      {children ?? <DownloadIcon className="size-4" />}
    </Button>
  );
};
