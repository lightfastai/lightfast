import { useCallback, useEffect, useState } from "react";

import { useEnvStore } from "../providers/env-provider";

type ApiStatus = "loading" | "connected" | "disconnected" | "error";

interface UseApiHealthOptions {
  intervalMs?: number;
}

const DEFAULT_INTERVAL = 60000; // Check every 1 minute

export function useApiHealth({
  intervalMs = DEFAULT_INTERVAL,
}: UseApiHealthOptions = {}): ApiStatus {
  const env = useEnvStore((state) => state.env);
  const envLoading = useEnvStore((state) => state.loading);
  const envError = useEnvStore((state) => state.error);

  const [status, setStatus] = useState<ApiStatus>("loading");

  const checkHealth = useCallback(async () => {
    console.log("Checking API health...", envLoading, envError);
    if (envLoading) {
      setStatus("loading");
      return;
    }
    if (envError || !env?.VITE_PUBLIC_LIGHTFAST_API_URL) {
      console.error(
        "API Health Check Error: Env vars failed to load or API URL is missing.",
        envError,
      );
      setStatus("error");
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
        signal: AbortSignal.timeout(intervalMs - 500),
      });

      if (response.ok) {
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
  }, [env, envLoading, envError, intervalMs]);

  useEffect(() => {
    checkHealth();

    const intervalId = setInterval(checkHealth, intervalMs);

    return () => clearInterval(intervalId);
  }, [checkHealth, intervalMs]);

  return status;
}
