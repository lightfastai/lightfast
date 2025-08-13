import { useState, useCallback, useEffect } from "react";
import { getDefaultModelForUser } from "~/lib/ai/providers";
import type { ModelId } from "~/lib/ai/providers";

/**
 * Hook for managing AI model selection with sessionStorage persistence.
 * Handles default model selection based on authentication status and
 * persists user's choice across page navigation.
 */
export function useModelSelection(isAuthenticated: boolean) {
	const defaultModel = getDefaultModelForUser(isAuthenticated);
	const [selectedModelId, setSelectedModelId] = useState<ModelId>(defaultModel);

	// Load persisted model selection after mount
	useEffect(() => {
		const storedModel = sessionStorage.getItem("selectedModelId");
		if (storedModel) {
			setSelectedModelId(storedModel as ModelId);
		} else {
			// If no stored model, use the appropriate default for the user's auth status
			setSelectedModelId(defaultModel);
		}
	}, [defaultModel]);

	// Handle model selection change with persistence
	const handleModelChange = useCallback((value: ModelId) => {
		setSelectedModelId(value);
		// Persist to sessionStorage to maintain selection across navigation
		if (typeof window !== "undefined") {
			sessionStorage.setItem("selectedModelId", value);
		}
	}, []);

	return {
		selectedModelId,
		handleModelChange,
		defaultModel,
	};
}