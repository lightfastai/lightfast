import type {
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useEffect } from "react";

import type { Database } from "~/types/supabase.types";
import { createClient } from "~/lib/supabase-client";

type PublicSchema = Database[Extract<keyof Database, "public">];
type Tables = PublicSchema["Tables"];
type TableName = keyof Tables;

interface UseRealtimeProps<TN extends TableName> {
  channelName: string;
  event?: RealtimePostgresChangesFilter<"*">["event"];
  table: TN;
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<Tables[TN]["Row"]>) => void;
  onConnectionStatusChange?: (status: string) => void;
}

export function useRealtime<TN extends TableName>({
  channelName,
  event = "*",
  table,
  filter,
  onEvent,
  onConnectionStatusChange,
}: UseRealtimeProps<TN>) {
  useEffect(() => {
    const supabase = createClient();

    const filterConfig: RealtimePostgresChangesFilter<"*"> = {
      event: event as "*",
      schema: "public",
      table,
      filter,
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        filterConfig,
        (payload: RealtimePostgresChangesPayload<Tables[TN]["Row"]>) => {
          console.log("payload", payload);
          onEvent(payload);
        },
      )
      .subscribe((status) => {
        // Report connection status changes
        onConnectionStatusChange?.(status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, event, table, filter, onEvent, onConnectionStatusChange]);
}
