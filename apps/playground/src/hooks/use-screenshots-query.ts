"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export interface Screenshot {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  filename?: string;
}

interface ScreenshotsResponse {
  screenshots: Screenshot[];
  nextCursor?: string;
}

async function fetchScreenshots(sessionId: string): Promise<ScreenshotsResponse> {
  const response = await fetch(`/playground/api/screenshots?sessionId=${sessionId}`);
  
  if (!response.ok) {
    throw new Error("Failed to fetch screenshots");
  }
  
  return response.json();
}

export function useScreenshotsQuery(sessionId: string, enabled: boolean = true) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const query = useQuery({
    queryKey: ["screenshots", sessionId],
    queryFn: () => fetchScreenshots(sessionId),
    enabled: enabled && !!sessionId,
    refetchInterval: 2000, // Poll every 2 seconds
    refetchIntervalInBackground: false,
  });
  
  // Reset index when thread changes or new screenshots arrive
  useEffect(() => {
    if (query.data?.screenshots.length) {
      // If we have screenshots and current index is -1, set to latest
      if (currentIndex === -1 || currentIndex >= query.data.screenshots.length) {
        setCurrentIndex(query.data.screenshots.length - 1);
      }
    } else {
      setCurrentIndex(0);
    }
  }, [query.data?.screenshots.length, sessionId]);
  
  const screenshots = query.data?.screenshots || [];
  const currentScreenshot = screenshots[currentIndex] || null;
  
  return {
    ...query,
    screenshots,
    currentScreenshot,
    currentIndex,
    setCurrentIndex,
    screenshotCount: screenshots.length,
    hasScreenshots: screenshots.length > 0,
  };
}