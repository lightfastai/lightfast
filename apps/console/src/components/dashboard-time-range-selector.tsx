"use client";

import { useAtom } from "jotai";
import { timeRangeAtom, type TimeRange } from "../stores/dashboard-preferences";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { Clock } from "lucide-react";

/**
 * Time Range Selector Component
 *
 * Provides tabs to switch between different time ranges (24h, 7d, 30d)
 * for dashboard metrics. Updates global state that affects all dashboard queries.
 */
export function DashboardTimeRangeSelector() {
	const [timeRange, setTimeRange] = useAtom(timeRangeAtom);

	const handleValueChange = (value: string) => {
		setTimeRange(value as TimeRange);
	};

	return (
		<div className="flex items-center gap-2">
			<Clock className="h-4 w-4 text-muted-foreground" />
			<Tabs value={timeRange} onValueChange={handleValueChange}>
				<TabsList className="h-9">
					<TabsTrigger value="24h" className="text-xs px-3">
						24h
					</TabsTrigger>
					<TabsTrigger value="7d" className="text-xs px-3">
						7d
					</TabsTrigger>
					<TabsTrigger value="30d" className="text-xs px-3">
						30d
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
