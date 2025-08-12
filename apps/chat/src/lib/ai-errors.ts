import { toast } from "sonner";

/**
 * Display an error toast for AI-related errors
 */
export function showAIErrorToast(error: unknown, customMessage?: string): void {
	const message = customMessage ?? "An error occurred while processing your message";
	
	// Log the actual error for debugging
	console.error("AI Error:", error);
	
	toast.error(message, {
		duration: 4000,
	});
}