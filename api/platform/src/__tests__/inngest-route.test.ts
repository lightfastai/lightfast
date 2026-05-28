import { describe, expect, it, vi } from "vitest";

const routeHandlers = {
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
};
const serveMock = vi.fn(() => routeHandlers);
const inngestClient = { id: "platform-inngest-client" };
const systemHealth = { id: "system-health" };

vi.mock("inngest/next", () => ({
  serve: serveMock,
}));

vi.mock("../env", () => ({
  env: {
    INNGEST_SERVE_ORIGIN: "https://platform.lightfast.localhost",
  },
}));

vi.mock("../inngest/client", () => ({
  inngest: inngestClient,
}));

vi.mock("../inngest/workflow/system-health", () => ({
  systemHealth,
}));

const { createInngestRouteContext, inngest } = await import("../inngest");

describe("createInngestRouteContext", () => {
  it("serves the platform Inngest client with system health workflow", () => {
    const handlers = createInngestRouteContext();

    expect(inngest).toBe(inngestClient);
    expect(handlers).toBe(routeHandlers);
    expect(serveMock).toHaveBeenCalledWith({
      client: inngestClient,
      functions: [systemHealth],
      serveOrigin: "https://platform.lightfast.localhost",
      servePath: "/api/inngest",
    });
  });
});
