import { describe, expect, it } from "vitest";

import { matchTier1Rules, parseHtml } from "./tier1.js";
import type { StaticData } from "./tier1.js";
import type { ToolSignature } from "../types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyData(): StaticData {
	return {
		headers: {},
		cookies: {},
		html: "",
		scriptSrcs: [],
		metaTags: [],
		inlineScripts: [],
		htmlLinks: [],
		dataAttrs: [],
	};
}

function makeSig(
	id: string,
	rules: ToolSignature["rules"],
): ToolSignature {
	return { id, name: id, category: "engineering", rules };
}

// ─── parseHtml ───────────────────────────────────────────────────────────────

describe("parseHtml", () => {
	describe("scriptSrcs", () => {
		it("extracts script src attributes", () => {
			const result = parseHtml('<script src="https://cdn.example.com/app.js"></script>');
			expect(result.scriptSrcs).toEqual(["https://cdn.example.com/app.js"]);
		});

		it("extracts multiple script srcs", () => {
			const result = parseHtml(
				'<script src="https://a.com/a.js"></script><script src="https://b.com/b.js"></script>',
			);
			expect(result.scriptSrcs).toHaveLength(2);
			expect(result.scriptSrcs).toContain("https://a.com/a.js");
			expect(result.scriptSrcs).toContain("https://b.com/b.js");
		});

		it("uses single quotes in src", () => {
			const result = parseHtml("<script src='https://cdn.example.com/app.js'></script>");
			expect(result.scriptSrcs).toEqual(["https://cdn.example.com/app.js"]);
		});

		it("does not include inline scripts without src", () => {
			const result = parseHtml("<script>console.log('hello')</script>");
			expect(result.scriptSrcs).toHaveLength(0);
		});
	});

	describe("metaTags", () => {
		it("extracts full meta tag strings", () => {
			const result = parseHtml('<meta name="generator" content="WordPress 6.0">');
			expect(result.metaTags).toHaveLength(1);
			expect(result.metaTags[0]).toContain('name="generator"');
		});

		it("extracts multiple meta tags", () => {
			const result = parseHtml(
				'<meta charset="UTF-8"><meta name="viewport" content="width=device-width">',
			);
			expect(result.metaTags).toHaveLength(2);
		});

		it("returns empty array when no meta tags exist", () => {
			const result = parseHtml("<html><body><p>No metas</p></body></html>");
			expect(result.metaTags).toHaveLength(0);
		});
	});

	describe("inlineScripts", () => {
		it("extracts inline script content", () => {
			const result = parseHtml("<script>window.myVar = true;</script>");
			expect(result.inlineScripts).toHaveLength(1);
			expect(result.inlineScripts[0]).toContain("window.myVar = true;");
		});

		it("does not include scripts with src attribute", () => {
			const result = parseHtml('<script src="external.js">/* ignored */</script>');
			expect(result.inlineScripts).toHaveLength(0);
		});

		it("ignores empty script tags", () => {
			const result = parseHtml("<script>   </script>");
			expect(result.inlineScripts).toHaveLength(0);
		});

		it("extracts multiple inline scripts", () => {
			const result = parseHtml(
				"<script>var a = 1;</script><script>var b = 2;</script>",
			);
			expect(result.inlineScripts).toHaveLength(2);
		});
	});

	describe("htmlLinks", () => {
		it("extracts href from anchor tags", () => {
			const result = parseHtml('<a href="https://example.com">link</a>');
			expect(result.htmlLinks).toEqual(["https://example.com"]);
		});

		it("extracts multiple hrefs", () => {
			const result = parseHtml(
				'<a href="https://a.com">A</a><a href="https://b.com">B</a>',
			);
			expect(result.htmlLinks).toHaveLength(2);
		});

		it("extracts relative links", () => {
			const result = parseHtml('<a href="/about">About</a>');
			expect(result.htmlLinks).toContain("/about");
		});
	});

	describe("dataAttrs", () => {
		it("extracts data-* attributes as full attribute strings", () => {
			const result = parseHtml('<div data-controller="posthog"></div>');
			expect(result.dataAttrs).toHaveLength(1);
			expect(result.dataAttrs[0]).toContain("data-controller");
			expect(result.dataAttrs[0]).toContain("posthog");
		});

		it("extracts multiple data attributes", () => {
			const result = parseHtml('<div data-foo="bar" data-baz="qux"></div>');
			expect(result.dataAttrs).toHaveLength(2);
		});
	});

	it("passes html through untouched", () => {
		const html = "<html><body>hello</body></html>";
		const result = parseHtml(html);
		expect(result.html).toBe(html);
	});
});

// ─── matchTier1Rules ──────────────────────────────────────────────────────────

describe("matchTier1Rules", () => {
	describe("header vector", () => {
		it("matches when check function returns true", () => {
			const sig = makeSig("tool", [
				{
					vector: "header",
					tier: 1,
					confidence: 0.9,
					check: (h) => !!h["x-powered-by"],
				},
			]);
			const data: StaticData = {
				...emptyData(),
				headers: { "x-powered-by": "Express" },
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.toolId).toBe("tool");
			expect(matches[0]?.vector).toBe("header");
			expect(matches[0]?.confidence).toBe(0.9);
			expect(matches[0]?.evidence).toContain("x-powered-by");
		});

		it("does not match when check function returns false", () => {
			const sig = makeSig("tool", [
				{
					vector: "header",
					tier: 1,
					confidence: 0.9,
					check: (h) => h.server === "Vercel",
				},
			]);
			const data: StaticData = {
				...emptyData(),
				headers: { server: "Apache" },
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});

		it("skips tier 2 rules", () => {
			const sig = makeSig("tool", [
				{
					vector: "header",
					tier: 2,
					confidence: 0.9,
					check: () => true,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				headers: { anything: "value" },
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("cookie vector", () => {
		it("matches via check function", () => {
			const sig = makeSig("tool", [
				{
					vector: "cookie",
					tier: 1,
					confidence: 0.8,
					check: (c) => "__posthog" in c,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				cookies: { __posthog: "abc123" },
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toBe("cookie match");
		});

		it("matches via pattern on cookie name", () => {
			const sig = makeSig("tool", [
				{
					vector: "cookie",
					tier: 1,
					confidence: 0.75,
					pattern: /^_ga/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				cookies: { _ga: "GA1.1.123", _gid: "GA1.1.456" },
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toContain("cookie:");
		});

		it("does not match when no cookies present", () => {
			const sig = makeSig("tool", [
				{
					vector: "cookie",
					tier: 1,
					confidence: 0.8,
					check: (c) => "__posthog" in c,
				},
			]);
			const matches = matchTier1Rules(emptyData(), "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("script_src vector", () => {
		it("matches via domains substring match", () => {
			const sig = makeSig("tool", [
				{
					vector: "script_src",
					tier: 1,
					confidence: 0.85,
					domains: ["cdn.posthog.com"],
				},
			]);
			const data: StaticData = {
				...emptyData(),
				scriptSrcs: ["https://cdn.posthog.com/array.js"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toContain("cdn.posthog.com");
		});

		it("matches via regex pattern", () => {
			const sig = makeSig("tool", [
				{
					vector: "script_src",
					tier: 1,
					confidence: 0.85,
					pattern: /intercom\.io/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				scriptSrcs: ["https://js.intercom.io/intercomx.js"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
		});

		it("does not match unrelated scripts", () => {
			const sig = makeSig("tool", [
				{
					vector: "script_src",
					tier: 1,
					confidence: 0.85,
					domains: ["cdn.posthog.com"],
				},
			]);
			const data: StaticData = {
				...emptyData(),
				scriptSrcs: ["https://cdn.example.com/other.js"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("meta_tag vector", () => {
		it("matches meta tag via pattern", () => {
			const sig = makeSig("tool", [
				{
					vector: "meta_tag",
					tier: 1,
					confidence: 0.9,
					pattern: /name="generator"\s+content="WordPress/i,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				metaTags: ['<meta name="generator" content="WordPress 6.0">'],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toContain("generator");
		});

		it("does not match when no meta tags", () => {
			const sig = makeSig("tool", [
				{
					vector: "meta_tag",
					tier: 1,
					confidence: 0.9,
					pattern: /generator.*WordPress/i,
				},
			]);
			const matches = matchTier1Rules(emptyData(), "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("inline_script vector", () => {
		it("matches inline script content via pattern", () => {
			const sig = makeSig("tool", [
				{
					vector: "inline_script",
					tier: 1,
					confidence: 0.8,
					pattern: /window\.analytics\s*=/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				inlineScripts: ["window.analytics = { track: function() {} };"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
		});

		it("includes context snippet in evidence", () => {
			const sig = makeSig("tool", [
				{
					vector: "inline_script",
					tier: 1,
					confidence: 0.8,
					pattern: /Intercom/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				inlineScripts: [
					"var app_id = 'xyz'; window.Intercom('boot', { app_id: app_id });",
				],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toContain("Intercom");
		});
	});

	describe("html_link vector", () => {
		it("matches external links via pattern", () => {
			const sig = makeSig("tool", [
				{
					vector: "html_link",
					tier: 1,
					confidence: 0.7,
					pattern: /discord\.com/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				htmlLinks: ["https://discord.com/invite/abc123"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
			expect(matches[0]?.evidence).toContain("discord.com");
		});

		it("skips mailto: links", () => {
			const sig = makeSig("tool", [
				{
					vector: "html_link",
					tier: 1,
					confidence: 0.7,
					pattern: /support@/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				htmlLinks: ["mailto:support@example.com"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});

		it("skips links pointing back to the target hostname", () => {
			const sig = makeSig("tool", [
				{
					vector: "html_link",
					tier: 1,
					confidence: 0.7,
					pattern: /example\.com/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				htmlLinks: ["https://example.com/about"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});

		it("skips tel: links", () => {
			const sig = makeSig("tool", [
				{
					vector: "html_link",
					tier: 1,
					confidence: 0.7,
					pattern: /\+1-800/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				htmlLinks: ["tel:+1-800-555-0000"],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});
	});

	describe("data_attr vector", () => {
		it("matches data attribute via pattern", () => {
			const sig = makeSig("tool", [
				{
					vector: "data_attr",
					tier: 1,
					confidence: 0.75,
					pattern: /data-sentry-component/,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				dataAttrs: ['data-sentry-component="MyComponent"'],
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches).toHaveLength(1);
		});
	});

	describe("multiple signatures and rules", () => {
		it("matches multiple tools from the same page data", () => {
			const sigs: ToolSignature[] = [
				makeSig("vercel", [
					{
						vector: "header",
						tier: 1,
						confidence: 0.95,
						check: (h) => !!h["x-vercel-id"],
					},
				]),
				makeSig("posthog", [
					{
						vector: "script_src",
						tier: 1,
						confidence: 0.9,
						domains: ["cdn.posthog.com"],
					},
				]),
			];
			const data: StaticData = {
				...emptyData(),
				headers: { "x-vercel-id": "iad1::xyz" },
				scriptSrcs: ["https://cdn.posthog.com/array.js"],
			};
			const matches = matchTier1Rules(data, "example.com", sigs);
			expect(matches).toHaveLength(2);
			const toolIds = matches.map((m) => m.toolId);
			expect(toolIds).toContain("vercel");
			expect(toolIds).toContain("posthog");
		});

		it("returns empty array when no rules match", () => {
			const sig = makeSig("tool", [
				{
					vector: "header",
					tier: 1,
					confidence: 0.9,
					check: (h) => !!h["x-vercel-id"],
				},
			]);
			const matches = matchTier1Rules(emptyData(), "example.com", [sig]);
			expect(matches).toHaveLength(0);
		});

		it("correctly sets tier on match objects", () => {
			const sig = makeSig("tool", [
				{
					vector: "header",
					tier: 1,
					confidence: 0.9,
					check: () => true,
				},
			]);
			const data: StaticData = {
				...emptyData(),
				headers: { foo: "bar" },
			};
			const matches = matchTier1Rules(data, "example.com", [sig]);
			expect(matches[0]?.tier).toBe(1);
		});
	});
});
