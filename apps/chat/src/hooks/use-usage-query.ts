import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

interface UseUsageQueryOptions {
	period?: string;
	enabled?: boolean;
}

/**
 * Hook for querying usage data for a specific period
 * Returns usage statistics including message counts and limits
 */
export function useUsageQuery({ period, enabled = true }: UseUsageQueryOptions = {}) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.usage.getByPeriod.queryOptions({
			period: period ?? (() => {
				const now = new Date();
				return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
			})(),
		}),
		enabled: enabled,
		staleTime: 1000 * 60 * 1, // 1 minute - usage can change frequently
		gcTime: 1000 * 60 * 5, // 5 minutes
	});
}

/**
 * Hook for querying current month usage
 */
export function useCurrentMonthUsage(options: { enabled?: boolean } = {}) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.usage.getCurrentMonth.queryOptions(),
		enabled: options.enabled ?? true,
		staleTime: 1000 * 60 * 1, // 1 minute
		gcTime: 1000 * 60 * 5, // 5 minutes
	});
}

/**
 * Hook for checking usage limits
 */
export function useUsageLimits({ period, enabled = true }: UseUsageQueryOptions = {}) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.usage.checkLimits.queryOptions({
			period,
		}),
		enabled: enabled,
		staleTime: 1000 * 60 * 1, // 1 minute
		gcTime: 1000 * 60 * 5, // 5 minutes
	});
}

/**
 * Hook for querying usage history
 */
export function useUsageHistory({ months = 6, enabled = true }: { months?: number; enabled?: boolean } = {}) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.usage.getHistory.queryOptions({
			months,
		}),
		enabled: enabled,
		staleTime: 1000 * 60 * 5, // 5 minutes - history doesn't change often
		gcTime: 1000 * 60 * 10, // 10 minutes
	});
}