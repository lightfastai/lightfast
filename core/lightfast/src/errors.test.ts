import { describe, it, expect } from "vitest";
import {
  LightfastError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  ServerError,
  NetworkError,
} from "./errors";

describe("LightfastError", () => {
  it("should create error with all properties", () => {
    const error = new LightfastError("TEST_CODE", "Test message", "req_123", 400);

    expect(error.name).toBe("LightfastError");
    expect(error.code).toBe("TEST_CODE");
    expect(error.message).toBe("Test message");
    expect(error.requestId).toBe("req_123");
    expect(error.status).toBe(400);
  });

  it("should serialize to JSON", () => {
    const error = new LightfastError("TEST_CODE", "Test message", "req_123", 400);
    const json = error.toJSON();

    expect(json).toEqual({
      name: "LightfastError",
      code: "TEST_CODE",
      message: "Test message",
      requestId: "req_123",
      status: 400,
    });
  });

  it("should be instanceof Error", () => {
    const error = new LightfastError("CODE", "message");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(LightfastError);
  });
});

describe("AuthenticationError", () => {
  it("should have correct properties", () => {
    const error = new AuthenticationError("Invalid key", "req_123");

    expect(error.name).toBe("AuthenticationError");
    expect(error.code).toBe("UNAUTHORIZED");
    expect(error.status).toBe(401);
    expect(error).toBeInstanceOf(LightfastError);
  });
});

describe("ValidationError", () => {
  it("should include details", () => {
    const details = { query: ["required"] };
    const error = new ValidationError("Invalid request", details, "req_123");

    expect(error.name).toBe("ValidationError");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(400);
    expect(error.details).toEqual(details);
  });
});

describe("NotFoundError", () => {
  it("should have correct properties", () => {
    const error = new NotFoundError("Resource not found", "req_123");

    expect(error.name).toBe("NotFoundError");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.status).toBe(404);
  });
});

describe("RateLimitError", () => {
  it("should include retryAfter", () => {
    const error = new RateLimitError("Too many requests", 60, "req_123");

    expect(error.name).toBe("RateLimitError");
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.status).toBe(429);
    expect(error.retryAfter).toBe(60);
  });
});

describe("ServerError", () => {
  it("should have correct properties", () => {
    const error = new ServerError("Internal error", "req_123");

    expect(error.name).toBe("ServerError");
    expect(error.code).toBe("SERVER_ERROR");
    expect(error.status).toBe(500);
  });
});

describe("NetworkError", () => {
  it("should include cause", () => {
    const cause = new Error("Connection refused");
    const error = new NetworkError("Network failure", cause);

    expect(error.name).toBe("NetworkError");
    expect(error.code).toBe("NETWORK_ERROR");
    expect(error.cause).toBe(cause);
  });
});
