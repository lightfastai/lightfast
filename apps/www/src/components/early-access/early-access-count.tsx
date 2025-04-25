"use client";

import { useEffect, useState } from "react";

import { log } from "@vendor/observability/log";

import { EarlyAccountCountUpdater } from "./early-access-count-updater";

export function EarlyAccessCount() {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch("/api/early-access/count", {
          method: "GET",
        });
        if (!response.ok) {
          log.error("Failed to fetch count", { response });
          throw new Error("Failed to fetch count");
        }
        const data = (await response.json()) as { count: number };
        setCount(data.count);
      } catch (err) {
        log.error("Error fetching waitlist count:", { err });
        setError(true);
      }
    };

    void fetchCount();
  }, []);

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
    <div className="col-span-12 mt-2 text-center duration-500 animate-in fade-in">
      <p className="text-xs text-muted-foreground">
        Join{" "}
        <span className="font-semibold">
          <EarlyAccountCountUpdater waitlistCount={count} />
        </span>{" "}
        others on the waitlist 🚀
      </p>
    </div>
  );
}
