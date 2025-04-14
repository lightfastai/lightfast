"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@vendor/db/supabase-db.types";
import { env } from "@vendor/db/env";

import { useNodeStore } from "../providers/node-store-provider";

interface UseRealtimeProps {
  workspaceId: string;
}

export const useRealtime = ({ workspaceId }: UseRealtimeProps) => {
  const { addNode, deleteNode, onNodesChange } = useNodeStore((state) => state);

  useEffect(() => {
    // Create Supabase client
    const supabase = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    // Subscribe to node changes
    const nodeSubscription = supabase
      .channel("node-changes")
      .on<Database["public"]["Tables"]["node"]["Row"]>(
        "postgres_changes",
        {
          event: "*", // Listen to all events
          schema: "public",
          table: "node",
          // filter: `workspace_id=eq.${workspaceId}`,
        },
        (
          payload: RealtimePostgresChangesPayload<
            Database["public"]["Tables"]["node"]["Row"]
          >,
        ) => {
          console.log("NODE", payload);
        },
      );

    // Start the subscriptions
    void nodeSubscription.subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      void supabase.removeChannel(nodeSubscription);
    };
  }, [workspaceId, addNode, deleteNode, onNodesChange]);
};
