import type {
  RealtimePostgresChangesFilter,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { useEffect } from "react";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "@vendor/db/media-server/schema";

import type { Database } from "~/types/supabase.types";
import { createClient } from "~/lib/supabase-client";

type PublicSchema = Database[Extract<keyof Database, "media_server">];
type Tables = PublicSchema["Tables"];
type TableName = keyof Tables;

interface UseRealtimeProps<TN extends TableName> {
  channelName: string;
  event?: RealtimePostgresChangesFilter<"*">["event"];
  table: TN;
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<Tables[TN]["Row"]>) => void;
}

export function useRealtime<TN extends TableName>({
  channelName,
  event = "*",
  table,
  filter,
  onEvent,
}: UseRealtimeProps<TN>) {
  useEffect(() => {
    const supabase = createClient();

    const filterConfig: RealtimePostgresChangesFilter<"*"> = {
      event: event as "*",
      schema: DEFAULT_MEDIA_SERVER_SCHEMA,
      table,
      filter,
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        filterConfig,
        (payload: RealtimePostgresChangesPayload<Tables[TN]["Row"]>) => {
          onEvent(payload);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, event, table, filter, onEvent]);
}
