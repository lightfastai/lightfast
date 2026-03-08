"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Clock } from "lucide-react";
import type { TimeRange } from "../stores/dashboard-preferences";
import { useDashboardPreferences } from "../stores/dashboard-preferences";

/**
 * Time Range Selector Component
 *
 * Provides tabs to switch between different time ranges (24h, 7d, 30d)
 * for dashboard metrics. Updates global state that affects all dashboard queries.
 */
export function DashboardTimeRangeSelector() {
  const timeRange = useDashboardPreferences((state) =>
    state.getCurrentTimeRange()
  );
  const setTimeRange = useDashboardPreferences(
    (state) => state.setCurrentTimeRange
  );

  const handleValueChange = (value: string) => {
    setTimeRange(value as TimeRange);
  };

  return (
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-muted-foreground" />
      <Tabs onValueChange={handleValueChange} value={timeRange}>
        <TabsList className="h-9">
          <TabsTrigger className="px-3 text-xs" value="24h">
            24h
          </TabsTrigger>
          <TabsTrigger className="px-3 text-xs" value="7d">
            7d
          </TabsTrigger>
          <TabsTrigger className="px-3 text-xs" value="30d">
            30d
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
