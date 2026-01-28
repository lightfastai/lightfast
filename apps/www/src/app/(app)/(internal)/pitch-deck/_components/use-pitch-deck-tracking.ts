"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePosthogAnalytics } from "@vendor/analytics/posthog-client";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";

interface TrackingMetadata {
  // UTM parameters for CRM correlation
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  // Session info
  session_id: string;
  device_type: "mobile" | "desktop";
  referrer: string;
}

export function usePitchDeckTracking() {
  const posthog = usePosthogAnalytics();
  const searchParams = useSearchParams();

  // Generate stable session ID for grouping events (using useState for stable initialization)
  const [sessionId] = useState(() => crypto.randomUUID());

  // Track which slides have been viewed this session (for deduplication)
  const viewedSlidesRef = useRef<Set<string>>(new Set());
  const deckCompletedRef = useRef(false);
  const mountTimeRef = useRef<number>(0);

  // Build tracking metadata from URL params
  const getMetadata = useCallback((): TrackingMetadata => {
    return {
      utm_source: searchParams.get("utm_source") ?? undefined,
      utm_medium: searchParams.get("utm_medium") ?? undefined,
      utm_campaign: searchParams.get("utm_campaign") ?? undefined,
      utm_content: searchParams.get("utm_content") ?? undefined,
      utm_term: searchParams.get("utm_term") ?? undefined,
      session_id: sessionId,
      device_type:
        typeof window !== "undefined" &&
        /Mobile|Android|iPhone/i.test(navigator.userAgent)
          ? "mobile"
          : "desktop",
      referrer: typeof document !== "undefined" ? document.referrer : "",
    };
  }, [searchParams, sessionId]);

  // Track deck opened on mount
  useEffect(() => {
    mountTimeRef.current = Date.now();

    posthog.capture("pitch_deck_opened", {
      ...getMetadata(),
      total_slides: PITCH_SLIDES.length,
    });
  }, [posthog, getMetadata]);

  // Track slide view (with deduplication)
  const trackSlideView = useCallback(
    (slideIndex: number) => {
      const slide = PITCH_SLIDES[slideIndex];
      if (!slide) return;

      // Deduplicate: only track first view of each slide per session
      if (viewedSlidesRef.current.has(slide.id)) return;
      viewedSlidesRef.current.add(slide.id);

      posthog.capture("pitch_slide_viewed", {
        ...getMetadata(),
        slide_index: slideIndex,
        slide_id: slide.id,
        slide_title: slide.title,
        slide_type: slide.type,
        slides_viewed_count: viewedSlidesRef.current.size,
      });

      // Check if all slides have been viewed
      if (
        viewedSlidesRef.current.size === PITCH_SLIDES.length &&
        !deckCompletedRef.current
      ) {
        deckCompletedRef.current = true;
        posthog.capture("pitch_deck_completed", {
          ...getMetadata(),
          total_slides: PITCH_SLIDES.length,
          time_to_complete_ms: Date.now() - mountTimeRef.current,
        });
      }
    },
    [posthog, getMetadata]
  );

  // Track grid view toggle
  const trackGridView = useCallback(
    (enabled: boolean) => {
      posthog.capture("pitch_deck_grid_toggled", {
        ...getMetadata(),
        grid_enabled: enabled,
        slides_viewed_at_toggle: viewedSlidesRef.current.size,
      });
    },
    [posthog, getMetadata]
  );

  // Track preface toggle
  const trackPrefaceToggle = useCallback(
    (expanded: boolean) => {
      posthog.capture("pitch_deck_preface_toggled", {
        ...getMetadata(),
        preface_expanded: expanded,
      });
    },
    [posthog, getMetadata]
  );

  // Track grid item click (navigation from grid)
  const trackGridItemClick = useCallback(
    (slideIndex: number) => {
      const slide = PITCH_SLIDES[slideIndex];
      posthog.capture("pitch_deck_grid_item_clicked", {
        ...getMetadata(),
        slide_index: slideIndex,
        slide_id: slide?.id,
        slide_title: slide?.title,
      });
    },
    [posthog, getMetadata]
  );

  return {
    trackSlideView,
    trackGridView,
    trackPrefaceToggle,
    trackGridItemClick,
    sessionId,
  };
}
