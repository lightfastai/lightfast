import { describe, expect, it } from "vitest";

import { getRouter } from "./router";

describe("local example", () => {
  it("creates the local root and index routes", () => {
    const router = getRouter();

    expect(Object.keys(router.routesById).sort()).toEqual(["/", "__root__"]);
  });
});
