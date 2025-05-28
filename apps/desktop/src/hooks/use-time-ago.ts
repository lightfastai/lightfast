import { useMemo } from "react";

export interface UseTimeAgoOptions {
  /**
   * If true, will show seconds for very recent times (default: true)
   */
  showSeconds?: boolean;
  /**
   * If true, will show 'just now' for < 5 seconds (default: true)
   */
  showJustNow?: boolean;
}

/**
 * Returns a human-readable time-ago string (e.g., '2 min ago', '1 hour ago', 'just now')
 * @param date Date object or timestamp (ms)
 * @param options Optional settings
 */
export function useTimeAgo(
  date: Date | number | undefined,
  options?: UseTimeAgoOptions,
): string {
  return useMemo(() => {
    if (!date) return "";
    const now = Date.now();
    const then = typeof date === "number" ? date : date.getTime();
    const diff = Math.max(0, now - then);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const opts = { showSeconds: true, showJustNow: true, ...options };

    if (opts.showJustNow && seconds < 5) return "just now";
    if (opts.showSeconds && seconds < 60) return `${seconds} sec ago`;
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    // Fallback to date string for older
    const d = new Date(then);
    return d.toLocaleDateString();
  }, [date, options?.showSeconds, options?.showJustNow]);
}
