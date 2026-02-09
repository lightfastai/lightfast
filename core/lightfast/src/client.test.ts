import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LightfastMemory, createLightfastMemory } from "./client";
import {
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ServerError,
  ValidationError,
} from "./errors";

describe("LightfastMemory", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should throw if apiKey is missing", () => {
      expect(() => new LightfastMemory({ apiKey: "" })).toThrow("API key is required");
    });

    it("should throw if apiKey has invalid format", () => {
      expect(() => new LightfastMemory({ apiKey: "invalid_key" })).toThrow(
        "Invalid API key format"
      );
    });

    it("should accept valid apiKey", () => {
      const memory = new LightfastMemory({ apiKey: "sk_live_test123" });
      expect(memory).toBeInstanceOf(LightfastMemory);
    });

    it("should use default baseUrl", () => {
      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      expect(memory).toBeInstanceOf(LightfastMemory);
    });

    it("should accept custom baseUrl", () => {
      const memory = new LightfastMemory({
        apiKey: "sk_test_abc",
        baseUrl: "https://custom.api.com",
      });
      expect(memory).toBeInstanceOf(LightfastMemory);
    });
  });

  describe("search", () => {
    it("should call /v1/search with correct parameters", async () => {
      const mockResponse = {
        data: [],
        meta: { total: 0, limit: 10, offset: 0, took: 100, mode: "balanced", paths: {} },
        latency: { total: 100 },
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      const result = await memory.search({ query: "test query" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/search",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk_test_abc",
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining('"query":"test query"'),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it("should apply default parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await memory.search({ query: "test" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        query: "test",
        limit: 10,
        offset: 0,
        mode: "balanced",
        includeContext: true,
        includeHighlights: true,
      });
    });
  });

  describe("contents", () => {
    it("should call /v1/contents with correct parameters", async () => {
      const mockResponse = {
        items: [],
        missing: [],
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      const result = await memory.contents({ ids: ["doc_123", "obs_456"] });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/contents",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ ids: ["doc_123", "obs_456"] }),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("findSimilar", () => {
    it("should call /v1/findsimilar with id", async () => {
      const mockResponse = {
        source: { id: "doc_123", title: "Test", type: "document" },
        similar: [],
        meta: { total: 0, took: 100, inputEmbedding: { found: true, generated: false } },
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      const result = await memory.findSimilar({ id: "doc_123" });

      expect(result).toEqual(mockResponse);
    });

    it("should throw ValidationError if neither id nor url provided", async () => {
      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await expect(memory.findSimilar({})).rejects.toThrow(ValidationError);
    });
  });

  describe("graph", () => {
    it("should call /v1/graph with correct parameters", async () => {
      const mockResponse = {
        data: {
          root: { id: "obs_123", title: "Test", source: "github", type: "issue" },
          nodes: [],
          edges: [],
        },
        meta: { depth: 2, nodeCount: 1, edgeCount: 0, took: 50 },
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      const result = await memory.graph({ id: "obs_123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/graph",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"id":"obs_123"'),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it("should apply default depth", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { root: {}, nodes: [], edges: [] } }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await memory.graph({ id: "obs_123" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.depth).toBe(2);
    });

    it("should pass custom depth and types", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { root: {}, nodes: [], edges: [] } }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await memory.graph({ id: "obs_123", depth: 3, types: ["fixes", "deploys"] });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        id: "obs_123",
        depth: 3,
        types: ["fixes", "deploys"],
      });
    });
  });

  describe("related", () => {
    it("should call /v1/related with correct parameters", async () => {
      const mockResponse = {
        data: {
          source: { id: "obs_123", title: "Test", source: "github" },
          related: [],
          bySource: {},
        },
        meta: { total: 0, took: 30 },
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      const result = await memory.related({ id: "obs_123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/related",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ id: "obs_123" }),
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("error handling", () => {
    it("should throw AuthenticationError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Invalid API key" }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await expect(memory.search({ query: "test" })).rejects.toThrow(AuthenticationError);
    });

    it("should throw ValidationError on 400", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid query" }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await expect(memory.search({ query: "test" })).rejects.toThrow(ValidationError);
    });

    it("should throw RateLimitError on 429", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: "Rate limit exceeded" }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await expect(memory.search({ query: "test" })).rejects.toThrow(RateLimitError);
    });

    it("should throw ServerError on 500", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
      });

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await expect(memory.search({ query: "test" })).rejects.toThrow(ServerError);
    });

    it("should throw NetworkError on fetch failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const memory = new LightfastMemory({ apiKey: "sk_test_abc" });
      await expect(memory.search({ query: "test" })).rejects.toThrow(NetworkError);
    });
  });

  describe("factory function", () => {
    it("should create LightfastMemory instance", () => {
      const memory = createLightfastMemory({ apiKey: "sk_test_abc" });
      expect(memory).toBeInstanceOf(LightfastMemory);
    });
  });
});
