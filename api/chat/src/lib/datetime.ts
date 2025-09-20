export function formatMySqlDateTime(date: Date): string {
	// MySQL DATETIME expects 'YYYY-MM-DD HH:MM:SS'; strip milliseconds and trailing 'Z'
	return date.toISOString().slice(0, 19).replace("T", " ");
}
