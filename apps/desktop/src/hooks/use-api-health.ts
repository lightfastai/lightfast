import { useCallback, useEffect, useState } from "react";

import { useEnv } from "../providers/env-provider";

type ApiStatus = "loading" | "connected" | "disconnected" | "error";

interface UseApiHealthOptions {
  intervalMs?: number;
}

const DEFAULT_INTERVAL = 60000; // Check every 1 minute

export function useApiHealth({
  intervalMs = DEFAULT_INTERVAL,
}: UseApiHealthOptions = {}): ApiStatus {
  const { env, loading: envLoading, error: envError } = useEnv();
  const [status, setStatus] = useState<ApiStatus>("loading");

  const checkHealth = useCallback(async () => {
    if (!env?.VITE_PUBLIC_LIGHTFAST_API_URL) {
      // If URL is not available yet or permanently, reflect that.
      setStatus(envLoading ? "loading" : "error");
      return;
    }

    const healthUrl = new URL(
      "/api/health",
      env.VITE_PUBLIC_LIGHTFAST_API_URL,
    ).toString();

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        // Add a timeout to prevent hanging indefinitely
        signal: AbortSignal.timeout(intervalMs - 500), // Timeout slightly less than interval
      });

      if (response.ok) {
        // You could optionally check the response body here if needed
        // const data = await response.json();
        setStatus("connected");
      } else {
        console.warn(`API health check failed with status: ${response.status}`);
        setStatus("disconnected");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        console.warn("API health check timed out.");
      } else if (
        error instanceof Error &&
        error.message.includes("Failed to fetch")
      ) {
        console.warn(
          "API health check failed: Network error or CORS issue.",
          error,
        );
      } else {
        console.error("API health check failed:", error);
      }
      setStatus("disconnected");
    }
  }, [env, envLoading, intervalMs]);

  useEffect(() => {
    if (envLoading || envError) {
      setStatus(envLoading ? "loading" : "error");
      return () => {}; // No interval needed if env isn't ready or failed
    }

    // Initial check
    checkHealth();

    // Set up interval
    const intervalId = setInterval(checkHealth, intervalMs);

    // Cleanup interval on unmount or when dependencies change
    return () => clearInterval(intervalId);
  }, [checkHealth, intervalMs, envLoading, envError]);

  return status;
}
