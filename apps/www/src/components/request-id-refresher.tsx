"use client";

import { useRefreshRequestId } from "@vendor/security/requests/client";

/**
 * This component simply initializes the request ID refresh mechanism.
 * It doesn't render anything visible.
 */
export function RequestIdProvider() {
  useRefreshRequestId({
    refreshInterval: 1000 * 60 * 5, // 5 minutes
    pingUrl: "/api/health",
  });

  return null;
}
