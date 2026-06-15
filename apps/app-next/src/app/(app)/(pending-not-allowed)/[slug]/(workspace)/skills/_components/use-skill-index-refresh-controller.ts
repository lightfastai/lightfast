"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";
import type { SkillsListResult } from "./skills-types";

const REFRESHABLE_STATUSES = new Set(["stale", "unavailable"]);
const POLLABLE_STATUSES = new Set(["refreshing", "stale", "unavailable"]);
const REFRESH_POLL_INTERVAL_MS = 5000;

export function useSkillIndexRefreshController(snapshot: SkillsListResult) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const attemptedRetryTicks = useRef(new Map<string, number>());
  const requestedVersions = useRef(new Set<string>());
  const retryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [retryTick, setRetryTick] = useState(0);
  const hasTerminalRefreshError = Boolean(
    snapshot.freshness.errorCode || snapshot.freshness.errorMessage
  );
  const { mutate } = useMutation(
    trpc.org.workspace.skills.requestRefresh.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.org.workspace.skills.list.queryFilter()
        );
      },
    })
  );

  useEffect(() => {
    const version = snapshot.snapshotVersion ?? "missing";
    if (!REFRESHABLE_STATUSES.has(snapshot.freshness.status)) {
      return;
    }
    if (hasTerminalRefreshError) {
      return;
    }
    if (requestedVersions.current.has(version)) {
      return;
    }
    if (attemptedRetryTicks.current.get(version) === retryTick) {
      return;
    }
    requestedVersions.current.add(version);
    attemptedRetryTicks.current.set(version, retryTick);
    mutate(
      {},
      {
        onError: () => {
          requestedVersions.current.delete(version);
          if (!retryTimers.current.has(version)) {
            const timer = setTimeout(() => {
              retryTimers.current.delete(version);
              setRetryTick((current) => current + 1);
            }, REFRESH_POLL_INTERVAL_MS);
            retryTimers.current.set(version, timer);
          }
        },
      }
    );
  }, [
    hasTerminalRefreshError,
    mutate,
    retryTick,
    snapshot.freshness.status,
    snapshot.snapshotVersion,
  ]);

  useEffect(
    () => () => {
      for (const timer of retryTimers.current.values()) {
        clearTimeout(timer);
      }
      retryTimers.current.clear();
    },
    []
  );

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    const source = new EventSource("/api/skills/index/events");
    const onSkillIndex = () => {
      void queryClient.invalidateQueries(
        trpc.org.workspace.skills.list.queryFilter()
      );
    };

    source.addEventListener("skill-index", onSkillIndex);

    return () => {
      source.close();
    };
  }, [queryClient, trpc]);

  useEffect(() => {
    if (!POLLABLE_STATUSES.has(snapshot.freshness.status)) {
      return;
    }
    if (hasTerminalRefreshError) {
      return;
    }

    const interval = setInterval(() => {
      void queryClient.invalidateQueries(
        trpc.org.workspace.skills.list.queryFilter()
      );
    }, REFRESH_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [hasTerminalRefreshError, queryClient, snapshot.freshness.status, trpc]);
}
