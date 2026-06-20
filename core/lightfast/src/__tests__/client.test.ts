import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createSignalOutput, getSignalOutput } from "@repo/api-contract";
import { describe, expect, it, vi } from "vitest";
import { createLightfast } from "../index";

const packageRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(packageRoot, path), "utf8");
}

describe("createLightfast", () => {
  it("uses explicit fetch routes without oRPC client dependencies", () => {
    const packageJson = JSON.parse(source("package.json")) as {
      dependencies?: Record<string, string>;
    };
    const clientSource = source("src/index.ts");
    const tsupSource = source("tsup.config.ts");

    expect(packageJson.dependencies?.["@orpc/client"]).toBeUndefined();
    expect(packageJson.dependencies?.["@orpc/contract"]).toBeUndefined();
    expect(packageJson.dependencies?.["@orpc/openapi-client"]).toBeUndefined();
    expect(clientSource).not.toContain("@orpc/");
    expect(clientSource).not.toContain("createORPCClient");
    expect(clientSource).not.toContain("OpenAPILink");
    expect(tsupSource).not.toContain("@orpc/");
  });

  it("rejects keys without the lf_ prefix", () => {
    expect(() => createLightfast("not-a-key")).toThrow(
      /Invalid Lightfast API key/
    );
  });

  it("rejects legacy ak_ keys", () => {
    expect(() => createLightfast("ak_legacy")).toThrow(
      /Invalid Lightfast API key/
    );
  });

  it("rejects bare lf_ keys", () => {
    expect(() => createLightfast("lf_")).toThrow(/Invalid Lightfast API key/);
  });

  it("attaches Authorization: Bearer <apiKey>", async () => {
    let lastRequest: { url: string; authHeader: string | null } | undefined;
    const fetchMock = vi.fn(async (input: Request) => {
      lastRequest = {
        url: input.url,
        authHeader: input.headers.get("authorization"),
      };
      return new Response(
        JSON.stringify({
          status: "ok",
          timestamp: "2026-05-10T00:00:00Z",
          version: "test",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("lf_test-key", {
      baseUrl: "https://example.test",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await lf.system.health();

    expect(result).toEqual({
      status: "ok",
      timestamp: "2026-05-10T00:00:00Z",
      version: "test",
    });
    expect(lastRequest?.authHeader).toBe("Bearer lf_test-key");
    expect(lastRequest?.url).toBe("https://example.test/api/v1/system/health");
  });

  it("strips trailing slash from baseUrl", async () => {
    let capturedUrl = "";
    const fetchMock = vi.fn(async (input: Request) => {
      capturedUrl = input.url;
      return new Response(
        JSON.stringify({ status: "ok", timestamp: "x", version: "x" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("lf_test", {
      baseUrl: "https://example.test/",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await lf.system.health();

    expect(capturedUrl).toBe("https://example.test/api/v1/system/health");
  });

  it("posts signal creation requests to the contract route", async () => {
    let lastRequest: { body: unknown; method: string; url: string } | undefined;
    const fetchMock = vi.fn(async (input: Request) => {
      lastRequest = {
        body: await input.json(),
        method: input.method,
        url: input.url,
      };
      return new Response(
        JSON.stringify({
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          status: "queued",
          visibilityScope: "user",
        }),
        { status: 202, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("lf_test", {
      baseUrl: "https://example.test",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await lf.signals.create({ input: "Classify this" });

    expect(result).toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
    expect(createSignalOutput.parse(result)).toEqual(result);
    expect(lastRequest).toEqual({
      body: { input: "Classify this" },
      method: "POST",
      url: "https://example.test/api/v1/signals",
    });
  });

  it("lists signals with optional filters on the contract route", async () => {
    let lastRequest: { method: string; url: string } | undefined;
    const fetchMock = vi.fn(async (input: Request) => {
      lastRequest = {
        method: input.method,
        url: input.url,
      };
      return new Response(
        JSON.stringify({
          items: [
            {
              classification: null,
              createdAt: "2026-05-21T00:00:00.000Z",
              id: "signal_123e4567-e89b-12d3-a456-426614174000",
              input: "Classify this",
              status: "queued",
              updatedAt: "2026-05-21T00:01:00.000Z",
              visibilityScope: "team",
            },
          ],
          nextCursor: "next_cursor",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("lf_test", {
      baseUrl: "https://example.test",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await lf.signals.list({
      cursor: "cursor_1",
      limit: 25,
      statuses: ["queued", "classified"],
    });

    expect(result).toEqual({
      items: [
        {
          classification: null,
          createdAt: "2026-05-21T00:00:00.000Z",
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          input: "Classify this",
          status: "queued",
          updatedAt: "2026-05-21T00:01:00.000Z",
          visibilityScope: "team",
        },
      ],
      nextCursor: "next_cursor",
    });
    expect(lastRequest).toEqual({
      method: "GET",
      url: "https://example.test/api/v1/signals?cursor=cursor_1&limit=25&statuses=queued%2Cclassified",
    });
  });

  it("interpolates signal ids into contract paths", async () => {
    let lastRequest: { method: string; url: string } | undefined;
    const fetchMock = vi.fn(async (input: Request) => {
      lastRequest = {
        method: input.method,
        url: input.url,
      };
      return new Response(
        JSON.stringify({
          classification: null,
          createdAt: "2026-05-21T00:00:00.000Z",
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          input: "Classify this",
          entityLinks: [],
          status: "queued",
          updatedAt: "2026-05-21T00:01:00.000Z",
          visibilityScope: "team",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const lf = createLightfast("lf_test", {
      baseUrl: "https://example.test/api/v1",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const result = await lf.signals.get({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
    });

    expect(result).toMatchObject({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
    });
    expect(getSignalOutput.parse(result)).toEqual(result);
    expect(lastRequest).toEqual({
      method: "GET",
      url: "https://example.test/api/v1/signals/signal_123e4567-e89b-12d3-a456-426614174000",
    });
  });
});
