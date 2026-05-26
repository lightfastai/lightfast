import { describe, expect, it } from "vitest";

import { organization } from "../index";

describe("organization reserved names", () => {
  it.each(["oauth", "ingest"])("reserves top-level app route %s", (slug) => {
    expect(organization.check(slug)).toBe(true);
  });

  it.each(["cli", "desktop"])("does not reserve OAuth client id %s", (slug) => {
    expect(organization.check(slug)).toBe(false);
  });
});
