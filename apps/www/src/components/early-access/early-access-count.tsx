"use client";

import { useEffect, useState } from "react";

import { useLogger } from "@vendor/observability/use-logger";

import { EarlyAccountCountUpdater } from "./early-access-count-updater";

export function EarlyAccessCount() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<boolean>(false);
  const logger = useLogger();

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch("/api/early-access/count", {
          method: "GET",
        });
        if (!response.ok) {
          logger.error("Failed to fetch count", { response });
          throw new Error("Failed to fetch count");
        }
        const data = (await response.json()) as { count: number };
        setCount(data.count);
      } catch (err) {
        logger.error("Error fetching waitlist count:", { err });
        setError(true);
      }
    };

    void fetchCount();
  }, [logger]);

  if (count === null && error) {
    return null;
  }

  if (error) {
    return null;
  }

  if (!count) {
    return null;
  }

  return (
    <div className="animate-fade-in col-span-12 mt-2 text-center">
      <p className="text-foreground text-xs">
        Join{" "}
        <span className="font-semibold">
          <EarlyAccountCountUpdater waitlistCount={count} />
        </span>{" "}
        others on the waitlist 🚀
      </p>
    </div>
  );
}
