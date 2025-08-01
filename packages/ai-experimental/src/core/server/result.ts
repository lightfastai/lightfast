/**
 * Result type for better error handling
 * Inspired by Rust's Result<T, E> type
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Helper functions for creating Result types
 */
export const Ok = <T>(value: T): Result<T, never> => ({
	ok: true,
	value,
});

export const Err = <E>(error: E): Result<never, E> => ({
	ok: false,
	error,
});

/**
 * Helper to map over a successful result
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	if (result.ok) {
		return Ok(fn(result.value));
	}
	return result;
}

/**
 * Helper to chain Result operations
 */
export function andThen<T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>): Result<U, E> {
	if (result.ok) {
		return fn(result.value);
	}
	return result;
}

/**
 * Helper to map error types
 */
export function mapError<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
	if (!result.ok) {
		return Err(fn(result.error));
	}
	return result;
}

/**
 * Helper to unwrap Result with a default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
	return result.ok ? result.value : defaultValue;
}

/**
 * Helper to check if all Results in an array are Ok
 */
export function allOk<T, E>(results: Result<T, E>[]): results is { ok: true; value: T }[] {
	return results.every((r) => r.ok);
}

/**
 * Collect an array of Results into a Result of array
 */
export function collect<T, E>(results: Result<T, E>[]): Result<T[], E> {
	const values: T[] = [];

	for (const result of results) {
		if (!result.ok) {
			return result;
		}
		values.push(result.value);
	}

	return Ok(values);
}
