import { describe, expect, it } from "vitest";
import { signInSearchParams, signUpSearchParams } from "./search-params";

describe("signInSearchParams.step", () => {
  const parser = signInSearchParams.step;

  it("parses valid step values", () => {
    expect(parser.parse("email")).toBe("email");
    expect(parser.parse("code")).toBe("code");
    expect(parser.parse("activate")).toBe("activate");
  });

  it("rejects invalid step values", () => {
    expect(parser.parse("invalid")).toBe(null);
    expect(parser.parse("")).toBe(null);
    expect(parser.parse("signup")).toBe(null);
  });

  it("serializes valid step values", () => {
    expect(parser.serialize("email")).toBe("email");
    expect(parser.serialize("code")).toBe("code");
    expect(parser.serialize("activate")).toBe("activate");
  });

  it("defaults to email", () => {
    expect(parser.defaultValue).toBe("email");
  });
});

describe("signUpSearchParams.step", () => {
  const parser = signUpSearchParams.step;

  it("parses valid step values", () => {
    expect(parser.parse("email")).toBe("email");
    expect(parser.parse("code")).toBe("code");
  });

  it("rejects activate (sign-up has no activate step)", () => {
    expect(parser.parse("activate")).toBe(null);
  });

  it("rejects invalid step values", () => {
    expect(parser.parse("invalid")).toBe(null);
    expect(parser.parse("")).toBe(null);
  });

  it("defaults to email", () => {
    expect(parser.defaultValue).toBe("email");
  });
});

describe("string params", () => {
  it("signInSearchParams.email parses strings", () => {
    expect(signInSearchParams.email.parse("user@example.com")).toBe(
      "user@example.com"
    );
  });

  it("signInSearchParams.email returns empty string for empty input", () => {
    expect(signInSearchParams.email.parse("")).toBe("");
  });

  it("signInSearchParams.redirect_url parses strings", () => {
    expect(
      signInSearchParams.redirect_url.parse(
        "https://lightfast.localhost/desktop/auth"
      )
    ).toBe("https://lightfast.localhost/desktop/auth");
  });

  it("signUpSearchParams.__clerk_ticket parses strings", () => {
    expect(signUpSearchParams.__clerk_ticket.parse("ticket-123")).toBe(
      "ticket-123"
    );
  });
});
