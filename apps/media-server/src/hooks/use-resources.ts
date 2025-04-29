"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "@repo/ui/hooks/use-toast";

import type { Resource } from "~/stores/resources";
import { useResourcesStore } from "~/providers/resources-provider";
import { createClient } from "../lib/supabase-client";
import { useRealtime } from "./use-realtime";

interface PaginationState {
  pageSize: number;
  cursor?: {
    created_at: string;
    id: string;
  };
}

interface SortingState {
  id: string;
  desc: boolean;
}

interface ResourcesResponse {
  data: Resource[];
  count: number;
}

export function useResources(
  pagination: PaginationState,
  sorting?: SortingState,
) {
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

        // Build the query
        let query = client.from("resource").select("*");

        // Apply sorting and cursor-based pagination
        const sortField = sorting?.id || "created_at";
        const sortAscending = sorting ? !sorting.desc : false;

        if (pagination.cursor) {
          // If we have a cursor, use it to fetch the next page
          if (sortAscending) {
            query = query
              .or(
                `created_at.gt.${pagination.cursor.created_at},and(created_at.eq.${pagination.cursor.created_at},id.gt.${pagination.cursor.id})`,
              )
              .order(sortField, { ascending: true })
              .order("id", { ascending: true });
          } else {
            query = query
              .or(
                `created_at.lt.${pagination.cursor.created_at},and(created_at.eq.${pagination.cursor.created_at},id.lt.${pagination.cursor.id})`,
              )
              .order(sortField, { ascending: false })
              .order("id", { ascending: false });
          }
        } else {
          // First page, just sort
          query = query
            .order(sortField, { ascending: sortAscending })
            .order("id", { ascending: sortAscending });
        }

        // Limit the number of records
        query = query.limit(pagination.pageSize);

        const { data, error } = await query;

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
  }, [
    pagination.cursor,
    pagination.pageSize,
    sorting,
    setLoading,
    setResources,
  ]);

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
