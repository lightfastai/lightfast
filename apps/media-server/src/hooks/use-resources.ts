"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Database } from "../types/supabase.types";
import { createClient } from "../lib/supabase-client";
import { useRealtime } from "./use-realtime";

export type Resource = Database["media_server"]["Tables"]["resource"]["Row"];

export const useResources = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

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
  }, []);

  // Handle realtime updates
  const handleRealtime = useCallback(
    (payload: { eventType: string; new: Resource; old: Resource }) => {
      setResources((prev) => {
        switch (payload.eventType) {
          case "INSERT":
            return [payload.new, ...prev];
          case "UPDATE":
            return prev.map((r) => (r.id === payload.new.id ? payload.new : r));
          case "DELETE":
            return prev.filter((r) => r.id !== payload.old.id);
          default:
            return prev;
        }
      });
    },
    [],
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
};
