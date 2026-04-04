import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLightfast, Lightfast } from "./client";
import {
  AuthenticationError,
  NetworkError,
  RateLimitError,
  ServerError,
  ValidationError,
} from "./errors";

describe("Lightfast", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should throw if apiKey is missing", () => {
      expect(() => new Lightfast({ apiKey: "" })).toThrow(
        "API key is required"
      );
    });

    it("should throw if apiKey has invalid format", () => {
      expect(
        () =>
          new Lightfast({
            apiKey: "invalid_key",
          })
      ).toThrow("Invalid API key format");
    });

    it("should accept valid apiKey", () => {
      const client = new Lightfast({
        apiKey: "sk-lf-live123test",
      });
      expect(client).toBeInstanceOf(Lightfast);
    });

    it("should use default baseUrl", () => {
      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      expect(client).toBeInstanceOf(Lightfast);
    });

    it("should accept custom baseUrl", () => {
      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
        baseUrl: "https://custom.api.com",
      });
      expect(client).toBeInstanceOf(Lightfast);
    });
  });

  describe("search", () => {
    it("should call /v1/search with correct parameters", async () => {
      const mockResponse = {
        results: [],
        total: 0,
        requestId: "req_123",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      const result = await client.search({ query: "test query" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/search",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk-lf-test123abc",
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

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      await client.search({ query: "test" });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        query: "test",
        limit: 10,
        offset: 0,
        mode: "balanced",
      });
    });
  });

  describe("proxySearch", () => {
    it("should call /v1/proxy/search", async () => {
      const mockResponse = {
        connections: [
          {
            installationId: "inst_123",
            provider: "github",
            status: "active",
            baseUrl: "https://api.github.com",
            endpoints: [
              {
                endpointId: "list-repos",
                method: "GET",
                path: "/user/repos",
                description: "List repositories",
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      const result = await client.proxySearch();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/proxy/search",
        expect.objectContaining({
          method: "POST",
        })
      );

      expect(result).toEqual(mockResponse);
    });
  });

  describe("proxyExecute", () => {
    it("should call /v1/proxy/execute with correct parameters", async () => {
      const mockResponse = {
        status: 200,
        data: [{ id: 1, name: "my-repo" }],
        headers: { "content-type": "application/json" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      const result = await client.proxyExecute({
        installationId: "inst_123",
        endpointId: "list-repos",
        queryParams: { per_page: "10" },
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        installationId: "inst_123",
        endpointId: "list-repos",
        queryParams: { per_page: "10" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://lightfast.ai/v1/proxy/execute",
        expect.objectContaining({
          method: "POST",
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

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      await expect(client.search({ query: "test" })).rejects.toThrow(
        AuthenticationError
      );
    });

    it("should throw ValidationError on 400", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Invalid query" }),
      });

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      await expect(client.search({ query: "test" })).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw RateLimitError on 429", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: "Rate limit exceeded" }),
      });

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      await expect(client.search({ query: "test" })).rejects.toThrow(
        RateLimitError
      );
    });

    it("should throw ServerError on 500", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
      });

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      await expect(client.search({ query: "test" })).rejects.toThrow(
        ServerError
      );
    });

    it("should throw NetworkError on fetch failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      const client = new Lightfast({
        apiKey: "sk-lf-test123abc",
      });
      await expect(client.search({ query: "test" })).rejects.toThrow(
        NetworkError
      );
    });
  });

  describe("factory function", () => {
    it("should create Lightfast instance", () => {
      const client = createLightfast({
        apiKey: "sk-lf-test123abc",
      });
      expect(client).toBeInstanceOf(Lightfast);
    });
  });
});
