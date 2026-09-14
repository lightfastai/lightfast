import assert from "node:assert/strict";

// Loaded only into the bundled stdio test subprocess. No request can reach a network.
/**
 * @param {Request | string | URL} request
 * @returns {Promise<Response>}
 */
const fixtureFetch = async (request) => {
  assert.ok(request instanceof Request);
  assert.equal(request.headers.get("authorization"), "Bearer lf_fixture");
  const url = new URL(request.url);
  assert.equal(url.origin, "https://mcp-fixture.invalid");

  if (url.pathname === "/api/v1/signals" && request.method === "POST") {
    assert.deepEqual(await request.json(), {
      input: "Run the verification plan",
    });
    return Response.json({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
  }
  if (url.pathname === "/api/v1/system/health" && request.method === "GET") {
    assert.equal(await request.text(), "");
    return Response.json({
      status: "ok",
      timestamp: "2026-05-21T00:00:00.000Z",
      version: "test",
    });
  }
  if (
    url.pathname ===
      "/api/v1/signals/signal_123e4567-e89b-12d3-a456-426614174000" &&
    request.method === "GET"
  ) {
    return Response.json(
      { message: "fixture unavailable" },
      {
        status: 503,
        statusText: "Service Unavailable",
      }
    );
  }
  throw new Error(`Unexpected fixture request: ${request.method} ${url}`);
};

globalThis.fetch = fixtureFetch;
