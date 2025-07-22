/**
 * Validates if a string is a valid UUID v4
 * @param value - The string to validate
 * @returns true if the string is a valid UUID v4, false otherwise
 */
export function isValidUUID(value: string): boolean {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(value);
}

/**
 * Type guard to check if a value is a valid UUID string
 */
export function isUUID(value: unknown): value is string {
	return typeof value === "string" && isValidUUID(value);
}
