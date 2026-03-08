"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Separator } from "@repo/ui/components/ui/separator";
import { Switch } from "@repo/ui/components/ui/switch";
import { Clock, Eye, RefreshCw, Settings } from "lucide-react";
import type { TimeRange } from "../stores/dashboard-preferences";
import { useDashboardPreferences } from "../stores/dashboard-preferences";

/**
 * Dashboard Settings Component
 *
 * Provides a dialog for configuring dashboard preferences:
 * - Auto-refresh interval
 * - Default time range
 * - Visible sections
 *
 * Settings are persisted to localStorage via Zustand.
 */
export function DashboardSettings() {
  const autoRefreshInterval = useDashboardPreferences(
    (state) => state.autoRefreshInterval
  );
  const defaultTimeRange = useDashboardPreferences(
    (state) => state.defaultTimeRange
  );
  const visibleSections = useDashboardPreferences(
    (state) => state.visibleSections
  );
  const setAutoRefreshInterval = useDashboardPreferences(
    (state) => state.setAutoRefreshInterval
  );
  const setDefaultTimeRange = useDashboardPreferences(
    (state) => state.setDefaultTimeRange
  );
  const setVisibleSection = useDashboardPreferences(
    (state) => state.setVisibleSection
  );
  const resetPreferences = useDashboardPreferences(
    (state) => state.resetPreferences
  );

  const handleAutoRefreshChange = (value: string) => {
    setAutoRefreshInterval(Number.parseInt(value, 10));
  };

  const handleDefaultTimeRangeChange = (value: string) => {
    setDefaultTimeRange(value as TimeRange);
  };

  const handleVisibilitySectionToggle = (
    section: keyof typeof visibleSections,
    enabled: boolean
  ) => {
    setVisibleSection(section, enabled);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2" size="sm" variant="ghost">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dashboard Settings</DialogTitle>
          <DialogDescription>
            Configure your dashboard preferences. Changes are saved
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Auto-refresh */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium text-sm" htmlFor="auto-refresh">
                Auto-refresh
              </Label>
            </div>
            <Select
              onValueChange={handleAutoRefreshChange}
              value={autoRefreshInterval.toString()}
            >
              <SelectTrigger id="auto-refresh">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Disabled</SelectItem>
                <SelectItem value="15">Every 15 seconds</SelectItem>
                <SelectItem value="30">Every 30 seconds</SelectItem>
                <SelectItem value="60">Every minute</SelectItem>
                <SelectItem value="300">Every 5 minutes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Automatically refresh dashboard data at the selected interval.
            </p>
          </div>

          <Separator />

          {/* Default Time Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium text-sm" htmlFor="default-range">
                Default Time Range
              </Label>
            </div>
            <Select
              onValueChange={handleDefaultTimeRangeChange}
              value={defaultTimeRange}
            >
              <SelectTrigger id="default-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              The initial time range shown when you load the dashboard.
            </p>
          </div>

          <Separator />

          {/* Visible Sections */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium text-sm">Visible Sections</Label>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm" htmlFor="section-metrics">
                    Metrics Grid
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Show key performance metrics
                  </p>
                </div>
                <Switch
                  checked={visibleSections.metrics}
                  id="section-metrics"
                  onCheckedChange={(checked) =>
                    handleVisibilitySectionToggle("metrics", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm" htmlFor="section-activity">
                    Recent Activity
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Show recent job activity
                  </p>
                </div>
                <Switch
                  checked={visibleSections.activity}
                  id="section-activity"
                  onCheckedChange={(checked) =>
                    handleVisibilitySectionToggle("activity", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm" htmlFor="section-sources">
                    Connected Sources
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Show connected source repositories
                  </p>
                </div>
                <Switch
                  checked={visibleSections.sources}
                  id="section-sources"
                  onCheckedChange={(checked) =>
                    handleVisibilitySectionToggle("sources", checked)
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm" htmlFor="section-stores">
                    Vector Stores
                  </Label>
                  <p className="text-muted-foreground text-xs">
                    Show vector store overview
                  </p>
                </div>
                <Switch
                  checked={visibleSections.stores}
                  id="section-stores"
                  onCheckedChange={(checked) =>
                    handleVisibilitySectionToggle("stores", checked)
                  }
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Reset Button */}
          <Button
            className="w-full"
            onClick={resetPreferences}
            variant="outline"
          >
            Reset to Defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
