/**
 * Pure function to extract error message without side effects
 * Does NOT capture to Sentry or log - caller's responsibility
 */
export const parseError = (error: unknown): string => {
	let message = "An error occurred";

	if (error instanceof Error) {
		message = error.message;
	} else if (error && typeof error === "object" && "message" in error) {
		message = error.message as string;
	} else if (typeof error === "string") {
		message = error;
	} else {
		message = String(error);
	}

	return message;
};
