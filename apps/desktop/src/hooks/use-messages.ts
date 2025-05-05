import { useCallback, useEffect, useRef, useState } from "react";

import { useScrollToBottom } from "./use-scroll-to-bottom";

interface UseMessagesProps {
  chatId: string;
  status: "idle" | "ready" | "submitted" | "error" | "streaming";
}

export function useMessages({ chatId, status }: UseMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [hasSentMessage, setHasSentMessage] = useState(false);
  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  // Auto-scroll to bottom when new messages come in or when streaming starts
  useEffect(() => {
    if (status === "streaming" || status === "submitted") {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  // If the user sends a message, set hasSentMessage to true
  useEffect(() => {
    if (status === "submitted") {
      setHasSentMessage(true);
    }
  }, [status]);

  // When containerRef changes, update the containerRef in useScrollToBottom
  useEffect(() => {
    if (containerRef.current) {
      // Set initial scroll position to bottom
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chatId]);

  // Callback for when the message end element enters viewport
  const onViewportEnter = useCallback(() => {
    // This function is called when the end element enters the viewport
  }, []);

  // Callback for when the message end element leaves viewport
  const onViewportLeave = useCallback(() => {
    // This function is called when the end element leaves the viewport
  }, []);

  return {
    containerRef,
    endRef,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
    isAtBottom,
    scrollToBottom,
  };
}
