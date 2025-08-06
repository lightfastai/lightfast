"use client";

import { useEffect, useState } from "react";
import { PlaygroundInterface } from "./playground-interface";
import { uuidv4 } from "@lightfast/core/v2/utils";

/**
 * Client-side wrapper that generates a new UUID for each mount
 * This ensures each new chat session gets a unique ID
 */
export function PlaygroundPageWrapper() {
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    // Generate UUID on client mount
    setThreadId(uuidv4());
  }, []);

  // Wait for UUID generation
  if (!threadId) {
    return null; // Or a loading spinner if preferred
  }

  return <PlaygroundInterface threadId={threadId} initialMessages={[]} />;
}