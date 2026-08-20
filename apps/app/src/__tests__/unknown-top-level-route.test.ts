import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  organizationRouteExists: vi.fn(),
}));

vi.mock("@api/app/tanstack/organizations", () => ({
  organizationRouteExists: mocks.organizationRouteExists,
}));

vi.mock("~/workspace/workspace-route-shell", () => ({
  WorkspaceRouteShell: () => null,
}));

const { Route } = await import("../routes/_authenticated/$slug");

describe("unknown top-level public routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects nonexistent organization slugs at the server route boundary", async () => {
    const loader = Route.options.loader;

    expect(loader).toBeTypeOf("function");
    if (typeof loader !== "function") {
      throw new TypeError("organization route loader is required");
    }

    mocks.organizationRouteExists.mockResolvedValueOnce(false);
    await expect(
      loader({ params: { slug: "not-a-real-route" } } as never)
    ).rejects.toMatchObject({ isNotFound: true });

    mocks.organizationRouteExists.mockResolvedValueOnce(true);
    await expect(
      loader({ params: { slug: "existing-team" } } as never)
    ).resolves.toBeUndefined();
  });

  it("marks genuine not-found HTML as noindex", () => {
    const rootRouteSource = readFileSync(
      resolve(import.meta.dirname, "../routes/__root.tsx"),
      "utf8"
    );

    expect(rootRouteSource).toContain(
      '<meta content="noindex" name="robots" />'
    );
  });
});
