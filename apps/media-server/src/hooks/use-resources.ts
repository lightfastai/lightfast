"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "@repo/ui/hooks/use-toast";

import type { Resource } from "~/stores/resources";
import { useResourcesStore } from "~/providers/resources-provider";
import { createClient } from "../lib/supabase-client";
import { useRealtime } from "./use-realtime";

interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

interface ResourcesResponse {
  data: Resource[];
  count: number;
}

export function useResources(pagination: PaginationState) {
  const setResources = useResourcesStore((state) => state.setResources);
  const setLoading = useResourcesStore((state) => state.setLoading);
  const resources = useResourcesStore((state) => state.resources);
  const loading = useResourcesStore((state) => state.loading);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Fetch paginated resources
  useEffect(() => {
    let isMounted = true;
    const fetchResources = async () => {
      setLoading(true);
      const client = createClient();

      try {
        // First, get the total count
        const { count } = await client
          .from("resource")
          .select("*", { count: "exact", head: true });

        if (!isMounted) return;

        if (count !== null) {
          setTotalCount(count);
        }

        // Then fetch the paginated data
        const from = pagination.pageIndex * pagination.pageSize;
        const to = from + pagination.pageSize - 1;

        const { data, error } = await client
          .from("resource")
          .select("*")
          .order("id", { ascending: false })
          .range(from, to);

        if (!isMounted) return;

        if (error) {
          console.error("Error fetching resources:", error);
          toast({
            title: "Error",
            description: "Failed to fetch resources",
            variant: "destructive",
          });
          return;
        }

        if (data) {
          setResources(data as Resource[]);
        }
      } catch (error) {
        console.error("Error fetching resources:", error);
        toast({
          title: "Error",
          description: "Failed to fetch resources",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchResources();
    return () => {
      isMounted = false;
    };
  }, [pagination.pageIndex, pagination.pageSize, setLoading, setResources]);

  // Handle realtime updates
  const addResource = useResourcesStore((state) => state.addResource);
  const updateResource = useResourcesStore((state) => state.updateResource);
  const removeResource = useResourcesStore((state) => state.removeResource);

  const handleRealtime = useCallback(
    (payload: { eventType: string; new: Resource; old: Resource }) => {
      switch (payload.eventType) {
        case "INSERT":
          addResource(payload.new);
          setTotalCount((prev) => prev + 1);
          toast({
            title: "New Resource Added",
            description: `${payload.new.type} resource created using ${payload.new.engine} engine.`,
            variant: "default",
            duration: 5000,
          });
          break;
        case "UPDATE":
          updateResource(payload.new.id, payload.new);
          break;
        case "DELETE":
          removeResource(payload.old.id);
          setTotalCount((prev) => Math.max(0, prev - 1));
          break;
      }
    },
    [addResource, updateResource, removeResource],
  );

  useRealtime({
    channelName: "resource-changes",
    table: "resource",
    event: "*",
    onEvent: (payload) => {
      handleRealtime({
        eventType: payload.eventType,
        new: payload.new as Resource,
        old: payload.old as Resource,
      });
    },
  });

  return { resources, loading, totalCount };
}
