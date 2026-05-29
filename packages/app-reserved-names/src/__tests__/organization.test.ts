import { describe, expect, it } from "vitest";

import reservedNames, { organization } from "../index";

describe("organization reserved names", () => {
  it.each(["oauth", "ingest"])("reserves top-level app route %s", (slug) => {
    expect(organization.check(slug)).toBe(true);
  });

  it.each([
    "android-chrome-192x192.png",
    "android-chrome-512x512.png",
    "apple-touch-icon.png",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "favicon-48x48.png",
    "fonts",
    "llms.txt",
    "manifest.webmanifest",
    "pitch-deck",
  ])("reserves top-level www microfrontend route %s", (slug) => {
    expect(organization.check(slug)).toBe(true);
  });

  it.each(["cli", "desktop"])("does not reserve OAuth client id %s", (slug) => {
    expect(organization.check(slug)).toBe(false);
  });
});

describe("reserved name data hygiene", () => {
  it("organization names are unique and lowercase", () => {
    const names = organization.all;
    expect(new Set(names).size).toBe(names.length);
    expect(names.every((name) => name === name.toLowerCase())).toBe(true);
    expect(names.every((name) => name.trim() === name && name.length > 0)).toBe(
      true
    );
  });
});

describe("main export", () => {
  it("exposes organization utilities", () => {
    expect(reservedNames.organization.check("settings")).toBe(true);
  });
});
