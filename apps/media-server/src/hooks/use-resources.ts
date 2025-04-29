"use client";

import { useCallback, useEffect } from "react";

import type { Resource } from "~/stores/resources";
import { useResourcesStore } from "~/providers/resources-provider";
import { createClient } from "../lib/supabase-client";
import { useRealtime } from "./use-realtime";

export function useResources() {
  const setResources = useResourcesStore((state) => state.setResources);
  const setLoading = useResourcesStore((state) => state.setLoading);
  const resources = useResourcesStore((state) => state.resources);
  const loading = useResourcesStore((state) => state.loading);

  // Fetch all resources on mount
  useEffect(() => {
    let isMounted = true;
    const fetchResources = async () => {
      setLoading(true);
      const client = createClient();
      const { data, error } = await client
        .from("resource")
        .select("*")
        .order("id", { ascending: false });
      if (isMounted) {
        if (!error && data) {
          setResources(data as Resource[]);
        }
        setLoading(false);
      }
    };
    fetchResources();
    return () => {
      isMounted = false;
    };
  }, [setLoading, setResources]);

  // Handle realtime updates
  const addResource = useResourcesStore((state) => state.addResource);
  const updateResource = useResourcesStore((state) => state.updateResource);
  const removeResource = useResourcesStore((state) => state.removeResource);

  const handleRealtime = useCallback(
    (payload: { eventType: string; new: Resource; old: Resource }) => {
      switch (payload.eventType) {
        case "INSERT":
          addResource(payload.new);
          break;
        case "UPDATE":
          updateResource(payload.new.id, payload.new);
          break;
        case "DELETE":
          removeResource(payload.old.id);
          break;
      }
    },
    [addResource, updateResource, removeResource],
  );

  useRealtime({
    channelName: "resource-changes",
    table: "resource",
    onEvent: (payload) => {
      handleRealtime({
        eventType: payload.eventType,
        new: payload.new as Resource,
        old: payload.old as Resource,
      });
    },
  });

  return { resources, loading };
}
