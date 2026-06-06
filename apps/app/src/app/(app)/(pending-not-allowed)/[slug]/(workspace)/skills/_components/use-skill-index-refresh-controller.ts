"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTRPC } from "~/trpc/react";
import type { SkillsListResult } from "./skills-types";

const REFRESHABLE_STATUSES = new Set(["stale", "unavailable"]);

export function useSkillIndexRefreshController(snapshot: SkillsListResult) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const requestedVersions = useRef(new Set<string>());
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
    requestedVersions.current.add(version);
    mutate({});
  }, [
    hasTerminalRefreshError,
    mutate,
    snapshot.freshness.status,
    snapshot.snapshotVersion,
  ]);
}
