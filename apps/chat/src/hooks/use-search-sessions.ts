"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/chat-trpc/react";
import { useState, useCallback, useMemo } from "react";
import { useDebouncedCallback } from "use-debounce";

export function useSearchSessions() {
	const trpc = useTRPC();
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");

	// Debounce the search query to avoid excessive API calls
	const debouncedSetQuery = useDebouncedCallback(
		(value: string) => {
			setDebouncedQuery(value);
		},
		300 // 300ms delay
	);

	// Update search query and trigger debounced update
	const handleSearchChange = useCallback((value: string) => {
		setSearchQuery(value);
		debouncedSetQuery(value);
	}, [debouncedSetQuery]);

	// Clear search
	const clearSearch = useCallback(() => {
		setSearchQuery("");
		setDebouncedQuery("");
	}, []);

	// Search query using the tRPC pattern
	const searchResults = useQuery({
		...trpc.session.search.queryOptions({
			query: debouncedQuery,
			limit: 30,
		}),
		enabled: debouncedQuery.length > 0,
		staleTime: 30000, // Cache for 30 seconds
	});

	// Determine if we're actively searching
	const isSearching = useMemo(() => {
		return searchQuery.length > 0;
	}, [searchQuery]);

	// Determine if search is loading (query entered but results not yet loaded)
	const isSearchLoading = useMemo(() => {
		return searchQuery.length > 0 && searchQuery !== debouncedQuery;
	}, [searchQuery, debouncedQuery]);

	return {
		// Search state
		searchQuery,
		isSearching,
		isSearchLoading: isSearchLoading || searchResults.isLoading,
		
		// Search results
		searchResults: searchResults.data ?? [],
		hasResults: (searchResults.data?.length ?? 0) > 0,
		
		// Actions
		handleSearchChange,
		clearSearch,
		
		// Query state from React Query
		isError: searchResults.isError,
		error: searchResults.error,
	};
}