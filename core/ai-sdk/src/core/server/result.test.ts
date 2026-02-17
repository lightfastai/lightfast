import { describe, expect, it } from "vitest";
import {
	andThen,
	collect,
	Err,
	mapError,
	mapResult,
	Ok,
	
	unwrapOr
} from "./result";
import type {Result} from "./result";

describe("Result", () => {
	describe("Ok function", () => {
		it("should create a successful result", () => {
			const result = Ok("success");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("success");
		});

		it("should create ok result with complex data", () => {
			const data = { id: 1, name: "test", items: [1, 2, 3] };
			const result = Ok(data);
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toEqual(data);
		});

		it("should create ok result with null data", () => {
			const result = Ok(null);
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBeNull();
		});

		it("should create ok result with undefined data", () => {
			const result = Ok(undefined);
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBeUndefined();
		});
	});

	describe("Err function", () => {
		it("should create an error result", () => {
			const result = Err("something went wrong");
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toBe("something went wrong");
		});

		it("should create error result with Error object", () => {
			const error = new Error("test error");
			const result = Err(error);
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toBe(error);
		});

		it("should create error result with custom error object", () => {
			const customError = { code: "E001", message: "Custom error" };
			const result = Err(customError);
			expect(result.ok).toBe(false);
			if (!result.ok) expect(result.error).toEqual(customError);
		});
	});

	describe("mapResult function", () => {
		it("should map over successful results", () => {
			const result = Ok(5);
			const mapped = mapResult(result, (x) => x * 2);
			expect(mapped.ok).toBe(true);
			if (mapped.ok) {
				expect(mapped.value).toBe(10);
			}
		});

		it("should not map over error results", () => {
			const result = Err("error");
			const mapped = mapResult(result, (x) => x * 2);
			expect(mapped.ok).toBe(false);
			if (!mapped.ok) {
				expect(mapped.error).toBe("error");
			}
		});
	});

	describe("andThen function", () => {
		it("should chain successful operations", () => {
			const result = Ok(5);
			const chained = andThen(result, (x) => Ok(x * 2));
			expect(chained.ok).toBe(true);
			if (chained.ok) {
				expect(chained.value).toBe(10);
			}
		});

		it("should not chain when first result is error", () => {
			const result = Err("initial error");
			const chained = andThen(result, (x) => Ok(x * 2));
			expect(chained.ok).toBe(false);
			if (!chained.ok) {
				expect(chained.error).toBe("initial error");
			}
		});

		it("should propagate error from chained operation", () => {
			const result = Ok(5);
			const chained = andThen(result, () => Err("chained error"));
			expect(chained.ok).toBe(false);
			if (!chained.ok) {
				expect(chained.error).toBe("chained error");
			}
		});
	});

	describe("mapError function", () => {
		it("should map error types", () => {
			const result = Err("string error");
			const mapped = mapError(result, (err) => new Error(err));
			expect(mapped.ok).toBe(false);
			if (!mapped.ok) {
				expect(mapped.error).toBeInstanceOf(Error);
				expect(mapped.error.message).toBe("string error");
			}
		});

		it("should not affect successful results", () => {
			const result = Ok(42);
			const mapped = mapError(result, (err) => new Error(String(err)));
			expect(mapped.ok).toBe(true);
			if (mapped.ok) {
				expect(mapped.value).toBe(42);
			}
		});
	});

	describe("unwrapOr function", () => {
		it("should return value for successful results", () => {
			const result = Ok(42);
			const value = unwrapOr(result, 0);
			expect(value).toBe(42);
		});

		it("should return default for error results", () => {
			const result = Err("error");
			const value = unwrapOr(result, 0);
			expect(value).toBe(0);
		});
	});

	describe("collect function", () => {
		it("should collect successful results", () => {
			const results = [Ok(1), Ok(2), Ok(3)];
			const collected = collect(results);
			expect(collected.ok).toBe(true);
			if (collected.ok) {
				expect(collected.value).toEqual([1, 2, 3]);
			}
		});

		it("should return first error when any result fails", () => {
			const results = [Ok(1), Err("error"), Ok(3)];
			const collected = collect(results);
			expect(collected.ok).toBe(false);
			if (!collected.ok) {
				expect(collected.error).toBe("error");
			}
		});

		it("should handle empty array", () => {
			const results: Result<number, string>[] = [];
			const collected = collect(results);
			expect(collected.ok).toBe(true);
			if (collected.ok) {
				expect(collected.value).toEqual([]);
			}
		});
	});

	describe("complex scenarios", () => {
		it("should handle async operations returning Results", async () => {
			const asyncOk = (): Promise<Result<string, Error>> => {
				return Promise.resolve(Ok("async success"));
			};

			const asyncErr = (): Promise<Result<string, Error>> => {
				return Promise.resolve(Err(new Error("async error")));
			};

			const result1 = await asyncOk();
			const result2 = await asyncErr();

			expect(result1.ok).toBe(true);
			expect(result2.ok).toBe(false);
		});

		it("should handle Result composition", () => {
			const parse = (input: string): Result<number, string> => {
				const num = Number(input);
				return isNaN(num) ? Err("not a number") : Ok(num);
			};

			const double = (num: number): Result<number, string> => {
				return Ok(num * 2);
			};

			const processInput = (input: string): Result<number, string> => {
				return andThen(parse(input), double);
			};

			const result1 = processInput("21");
			expect(result1.ok).toBe(true);
			if (result1.ok) {
				expect(result1.value).toBe(42);
			}

			const result2 = processInput("not-a-number");
			expect(result2.ok).toBe(false);
			if (!result2.ok) {
				expect(result2.error).toBe("not a number");
			}
		});
	});
});
