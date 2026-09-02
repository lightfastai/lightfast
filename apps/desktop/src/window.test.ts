import { describe, expect, it } from "vitest";

import { createWindowOptions } from "./window";

describe("desktop static window", () => {
  it("enforces the local static-shell security posture", () => {
    expect(createWindowOptions()).toMatchObject({
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
  });
});
