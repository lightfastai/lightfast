"use client";

import { useAtom } from "jotai";
import { dashboardPreferencesAtom, type TimeRange } from "../stores/dashboard-preferences";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { Label } from "@repo/ui/components/ui/label";
import { Switch } from "@repo/ui/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Settings, RefreshCw, Clock, Eye } from "lucide-react";
import { Separator } from "@repo/ui/components/ui/separator";

/**
 * Dashboard Settings Component
 *
 * Provides a dialog for configuring dashboard preferences:
 * - Auto-refresh interval
 * - Default time range
 * - Visible sections
 *
 * Settings are persisted to localStorage via Jotai.
 */
export function DashboardSettings() {
	const [preferences, setPreferences] = useAtom(dashboardPreferencesAtom);

	const handleAutoRefreshChange = (value: string) => {
		setPreferences({
			...preferences,
			autoRefreshInterval: Number.parseInt(value, 10),
		});
	};

	const handleDefaultTimeRangeChange = (value: string) => {
		setPreferences({
			...preferences,
			defaultTimeRange: value as TimeRange,
		});
	};

	const handleVisibilitySectionToggle = (
		section: keyof typeof preferences.visibleSections,
		enabled: boolean
	) => {
		setPreferences({
			...preferences,
			visibleSections: {
				...preferences.visibleSections,
				[section]: enabled,
			},
		});
	};

	const resetToDefaults = () => {
		setPreferences({
			autoRefreshInterval: 30,
			defaultTimeRange: "24h",
			visibleSections: {
				metrics: true,
				activity: true,
				sources: true,
				stores: true,
			},
		});
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm" className="gap-2">
					<Settings className="h-4 w-4" />
					<span className="hidden sm:inline">Settings</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Dashboard Settings</DialogTitle>
					<DialogDescription>
						Configure your dashboard preferences. Changes are saved automatically.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Auto-refresh */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<RefreshCw className="h-4 w-4 text-muted-foreground" />
							<Label htmlFor="auto-refresh" className="text-sm font-medium">
								Auto-refresh
							</Label>
						</div>
						<Select
							value={preferences.autoRefreshInterval.toString()}
							onValueChange={handleAutoRefreshChange}
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
						<p className="text-xs text-muted-foreground">
							Automatically refresh dashboard data at the selected interval.
						</p>
					</div>

					<Separator />

					{/* Default Time Range */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4 text-muted-foreground" />
							<Label htmlFor="default-range" className="text-sm font-medium">
								Default Time Range
							</Label>
						</div>
						<Select
							value={preferences.defaultTimeRange}
							onValueChange={handleDefaultTimeRangeChange}
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
						<p className="text-xs text-muted-foreground">
							The initial time range shown when you load the dashboard.
						</p>
					</div>

					<Separator />

					{/* Visible Sections */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<Eye className="h-4 w-4 text-muted-foreground" />
							<Label className="text-sm font-medium">Visible Sections</Label>
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="section-metrics" className="text-sm">
										Metrics Grid
									</Label>
									<p className="text-xs text-muted-foreground">
										Show key performance metrics
									</p>
								</div>
								<Switch
									id="section-metrics"
									checked={preferences.visibleSections.metrics}
									onCheckedChange={(checked) =>
										handleVisibilitySectionToggle("metrics", checked)
									}
								/>
							</div>
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="section-activity" className="text-sm">
										Recent Activity
									</Label>
									<p className="text-xs text-muted-foreground">
										Show recent job activity
									</p>
								</div>
								<Switch
									id="section-activity"
									checked={preferences.visibleSections.activity}
									onCheckedChange={(checked) =>
										handleVisibilitySectionToggle("activity", checked)
									}
								/>
							</div>
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="section-sources" className="text-sm">
										Connected Sources
									</Label>
									<p className="text-xs text-muted-foreground">
										Show connected source repositories
									</p>
								</div>
								<Switch
									id="section-sources"
									checked={preferences.visibleSections.sources}
									onCheckedChange={(checked) =>
										handleVisibilitySectionToggle("sources", checked)
									}
								/>
							</div>
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label htmlFor="section-stores" className="text-sm">
										Vector Stores
									</Label>
									<p className="text-xs text-muted-foreground">
										Show vector store overview
									</p>
								</div>
								<Switch
									id="section-stores"
									checked={preferences.visibleSections.stores}
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
						variant="outline"
						onClick={resetToDefaults}
						className="w-full"
					>
						Reset to Defaults
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
