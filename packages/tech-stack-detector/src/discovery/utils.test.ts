import { describe, expect, it } from "vitest";

import { extractRootDomain, isSubdomainOf } from "./utils.js";

// ─── extractRootDomain ────────────────────────────────────────────────────────

describe("extractRootDomain", () => {
	it("returns the hostname unchanged when it has only 2 parts", () => {
		expect(extractRootDomain("example.com")).toBe("example.com");
		expect(extractRootDomain("linear.app")).toBe("linear.app");
	});

	it("strips one level of subdomain", () => {
		expect(extractRootDomain("app.example.com")).toBe("example.com");
		expect(extractRootDomain("dashboard.clerk.com")).toBe("clerk.com");
		expect(extractRootDomain("api.linear.app")).toBe("linear.app");
	});

	it("strips multiple levels of subdomains", () => {
		expect(extractRootDomain("eu.i.posthog.com")).toBe("posthog.com");
		expect(extractRootDomain("a.b.c.example.com")).toBe("example.com");
	});

	it("handles known two-part TLDs (co.uk)", () => {
		expect(extractRootDomain("www.example.co.uk")).toBe("example.co.uk");
		expect(extractRootDomain("app.example.co.uk")).toBe("example.co.uk");
	});

	it("handles known two-part TLDs (com.au)", () => {
		expect(extractRootDomain("dashboard.acme.com.au")).toBe("acme.com.au");
	});

	it("handles known two-part TLDs (com.br)", () => {
		expect(extractRootDomain("app.example.com.br")).toBe("example.com.br");
	});

	it("handles known two-part TLDs (org.uk)", () => {
		expect(extractRootDomain("www.charity.org.uk")).toBe("charity.org.uk");
	});

	it("returns just the hostname when it has exactly 2 parts", () => {
		expect(extractRootDomain("co.uk")).toBe("co.uk");
	});

	it("handles single-part hostnames (edge case)", () => {
		expect(extractRootDomain("localhost")).toBe("localhost");
	});
});

// ─── isSubdomainOf ────────────────────────────────────────────────────────────

describe("isSubdomainOf", () => {
	it("returns true for a direct subdomain", () => {
		expect(isSubdomainOf("app.example.com", "example.com")).toBe(true);
		expect(isSubdomainOf("dashboard.clerk.com", "clerk.com")).toBe(true);
		expect(isSubdomainOf("api.linear.app", "linear.app")).toBe(true);
	});

	it("returns true for deep nested subdomains", () => {
		expect(isSubdomainOf("eu.eu.posthog.com", "posthog.com")).toBe(true);
	});

	it("returns false for exact root domain match", () => {
		expect(isSubdomainOf("example.com", "example.com")).toBe(false);
	});

	it("returns false for www subdomain", () => {
		expect(isSubdomainOf("www.example.com", "example.com")).toBe(false);
	});

	it("returns false for a completely different domain", () => {
		expect(isSubdomainOf("other.com", "example.com")).toBe(false);
	});

	it("returns false when hostname does not end with .rootDomain", () => {
		// e.g. "notexample.com" does not end with ".example.com"
		expect(isSubdomainOf("notexample.com", "example.com")).toBe(false);
	});

	it("returns false for a sibling domain that shares a suffix", () => {
		// "myexample.com" ends with "example.com" but has no dot before it
		expect(isSubdomainOf("myexample.com", "example.com")).toBe(false);
	});
});
