"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "anonymousMessageCount";
const DAILY_LIMIT = 10;

interface MessageLimitData {
	count: number;
	resetDate: string;
}

export function useAnonymousMessageLimit() {
	const [messageCount, setMessageCount] = useState<number>(0);
	const [isLoading, setIsLoading] = useState(true);

	// Get the current date in YYYY-MM-DD format (user's local timezone)
	const getCurrentDate = (): string => {
		return new Date().toISOString().split("T")[0] ?? "";
	};

	// Load and validate the stored data
	const loadMessageCount = useCallback(() => {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			const today = getCurrentDate();

			if (!stored) {
				// No data stored yet, initialize
				const initialData: MessageLimitData = {
					count: 0,
					resetDate: today,
				};
				localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
				setMessageCount(0);
			} else {
				const data = JSON.parse(stored) as MessageLimitData;

				// Check if we need to reset (new day)
				if (data.resetDate !== today) {
					// Reset for new day
					const resetData: MessageLimitData = {
						count: 0,
						resetDate: today,
					};
					localStorage.setItem(STORAGE_KEY, JSON.stringify(resetData));
					setMessageCount(0);
				} else {
					// Use existing count
					setMessageCount(data.count);
				}
			}
		} catch (error) {
			// If localStorage is unavailable or corrupted, just use 0
			console.warn("Failed to load message count from localStorage:", error);
			setMessageCount(0);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Increment the message count
	const incrementCount = useCallback(() => {
		try {
			const today = getCurrentDate();
			const stored = localStorage.getItem(STORAGE_KEY);
			
			let data: MessageLimitData;
			if (!stored) {
				data = { count: 0, resetDate: today };
			} else {
				data = JSON.parse(stored) as MessageLimitData;
				// Reset if it's a new day
				if (data.resetDate !== today) {
					data = { count: 0, resetDate: today };
				}
			}

			// Increment count
			data.count = Math.min(data.count + 1, DAILY_LIMIT);
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			setMessageCount(data.count);
		} catch (error) {
			console.warn("Failed to increment message count:", error);
			// Still increment in memory even if localStorage fails
			setMessageCount((prev) => Math.min(prev + 1, DAILY_LIMIT));
		}
	}, []);

	// Load on mount and listen for storage changes (cross-tab sync)
	useEffect(() => {
		loadMessageCount();

		// Listen for changes from other tabs
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
				loadMessageCount();
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, [loadMessageCount]);

	const remainingMessages = Math.max(0, DAILY_LIMIT - messageCount);
	const hasReachedLimit = messageCount >= DAILY_LIMIT;

	return {
		messageCount,
		remainingMessages,
		hasReachedLimit,
		incrementCount,
		isLoading,
	};
}