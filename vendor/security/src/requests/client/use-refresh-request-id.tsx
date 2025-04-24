"use client";

import { useEffect, useRef } from "react";
import Cookies from "js-cookie";

import { REQUEST_ID_HEADER } from "../constants";

const REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes (before 5 minute expiry)

interface UseRefreshRequestIdOptions {
  refreshInterval?: number;
  pingUrl?: string;
}

/**
 * This hook periodically refreshes the request ID by making a lightweight ping request
 * to prevent users from experiencing "expired request ID" errors when staying on the
 * site for extended periods.
 *
 * @param options.refreshInterval - The interval (in milliseconds) to refresh the request ID
 * @param options.pingUrl - The URL to ping to refresh the request ID
 */
export function useRefreshRequestId({
  refreshInterval = REFRESH_INTERVAL,
  pingUrl = "/api/health",
}: UseRefreshRequestIdOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const ping = async () => {
      try {
        // Make a lightweight request to any public endpoint to refresh the request ID
        const res = await fetch(pingUrl);

        // The response will contain a fresh request ID in the header
        // which will be set as a cookie by the middleware
        if (!res.ok) {
          console.error("Failed to refresh request ID", {
            status: res.status,
          });
        }
      } catch (error) {
        console.error("Error refreshing request ID:", error);
      }
    };

    // Check if we have a request ID cookie
    const hasRequestId = !!Cookies.get(REQUEST_ID_HEADER);

    if (hasRequestId) {
      // Start periodic refresh
      intervalRef.current = setInterval(ping, refreshInterval);

      // Also refresh immediately if we're close to expiry
      const refreshNow = async () => {
        // If the page was loaded and has been inactive, refresh immediately
        await ping();
      };

      // Run initial refresh after a short delay
      const initialTimeout = setTimeout(refreshNow, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        clearTimeout(initialTimeout);
      };
    }
  }, [refreshInterval, pingUrl]);
}
