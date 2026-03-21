import { describe, expect, it } from "vitest";
import { earlyAccessSearchParams } from "./search-params";

describe("earlyAccessSearchParams", () => {
  describe("email", () => {
    const parser = earlyAccessSearchParams.email;

    it("parses string values", () => {
      expect(parser.parse("test@example.com")).toBe("test@example.com");
    });

    it("returns empty string for empty input", () => {
      expect(parser.parse("")).toBe("");
    });

    it("defaults to empty string", () => {
      expect(parser.defaultValue).toBe("");
    });
  });

  describe("companySize", () => {
    const parser = earlyAccessSearchParams.companySize;

    it("parses string values", () => {
      expect(parser.parse("11-50")).toBe("11-50");
    });

    it("defaults to empty string", () => {
      expect(parser.defaultValue).toBe("");
    });
  });

  describe("sources", () => {
    const parser = earlyAccessSearchParams.sources;

    it("parses comma-separated string", () => {
      expect(parser.parse("github,slack")).toBe("github,slack");
    });

    it("defaults to empty string", () => {
      expect(parser.defaultValue).toBe("");
    });
  });

  describe("error", () => {
    const parser = earlyAccessSearchParams.error;

    it("parses error messages", () => {
      expect(parser.parse("Something went wrong")).toBe("Something went wrong");
    });

    it("has no default (nullable)", () => {
      expect((parser as Record<string, unknown>).defaultValue).toBeUndefined();
    });
  });

  describe("emailError", () => {
    const parser = earlyAccessSearchParams.emailError;

    it("parses validation messages", () => {
      expect(parser.parse("Please enter a valid email")).toBe(
        "Please enter a valid email"
      );
    });

    it("has no default (nullable)", () => {
      expect((parser as Record<string, unknown>).defaultValue).toBeUndefined();
    });
  });

  describe("sourcesError", () => {
    const parser = earlyAccessSearchParams.sourcesError;

    it("parses validation messages", () => {
      expect(parser.parse("Please select at least one")).toBe(
        "Please select at least one"
      );
    });

    it("has no default (nullable)", () => {
      expect((parser as Record<string, unknown>).defaultValue).toBeUndefined();
    });
  });

  describe("companySizeError", () => {
    const parser = earlyAccessSearchParams.companySizeError;

    it("parses validation messages", () => {
      expect(parser.parse("Company size is required")).toBe(
        "Company size is required"
      );
    });

    it("has no default (nullable)", () => {
      expect((parser as Record<string, unknown>).defaultValue).toBeUndefined();
    });
  });

  describe("isRateLimit", () => {
    const parser = earlyAccessSearchParams.isRateLimit;

    it("parses 'true' as true", () => {
      expect(parser.parse("true")).toBe(true);
    });

    it("parses 'false' as false", () => {
      expect(parser.parse("false")).toBe(false);
    });

    it("defaults to false", () => {
      expect(parser.defaultValue).toBe(false);
    });
  });

  describe("success", () => {
    const parser = earlyAccessSearchParams.success;

    it("parses 'true' as true", () => {
      expect(parser.parse("true")).toBe(true);
    });

    it("parses 'false' as false", () => {
      expect(parser.parse("false")).toBe(false);
    });

    it("defaults to false", () => {
      expect(parser.defaultValue).toBe(false);
    });
  });
});
