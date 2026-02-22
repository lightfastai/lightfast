import type { DetectionRule, RuleMatch, ToolSignature } from "../types.js";

/** Build concise evidence for a header match by checking which specific headers triggered it */
function headerEvidence(
	rule: DetectionRule,
	headers: Record<string, string>,
): string {
	// Try common known header patterns for concise evidence
	for (const key of [
		"server",
		"x-vercel-id",
		"x-nextjs-prerender",
		"x-nextjs-cache",
		"x-nf-request-id",
		"x-render-origin-server",
		"x-railway-request-id",
		"rsc",
	]) {
		if (headers[key] !== undefined) {
			// Check if this specific header contributes to the match
			const single: Record<string, string> = { [key]: headers[key]! };
			if (rule.check?.(single)) {
				return `${key}: ${headers[key]}`;
			}
		}
	}
	// Fallback: list x-* and server headers briefly
	return Object.entries(headers)
		.filter(([k]) => k.startsWith("x-") || k === "server")
		.slice(0, 2)
		.map(([k, v]) => `${k}: ${v}`)
		.join(", ") || "header match";
}

interface StaticData {
	headers: Record<string, string>;
	cookies: Record<string, string>;
	html: string;
	scriptSrcs: string[];
	metaTags: string[];
	inlineScripts: string[];
	htmlLinks: string[];
	dataAttrs: string[];
}

function parseHtml(html: string): Omit<StaticData, "headers" | "cookies"> {
	const scriptSrcs: string[] = [];
	const metaTags: string[] = [];
	const inlineScripts: string[] = [];
	const htmlLinks: string[] = [];
	const dataAttrs: string[] = [];

	// Extract <script src="...">
	for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
		scriptSrcs.push(m[1]!);
	}

	// Extract <meta ...> tags (full tag for pattern matching)
	for (const m of html.matchAll(/<meta[^>]+>/gi)) {
		metaTags.push(m[0]);
	}

	// Extract inline <script>...</script> content
	for (const m of html.matchAll(
		/<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi,
	)) {
		if (m[1]?.trim()) {
			inlineScripts.push(m[1]);
		}
	}

	// Extract <a href="...">
	for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
		htmlLinks.push(m[1]!);
	}

	// Extract data-* attributes
	for (const m of html.matchAll(/data-[\w-]+=["']([^"']*)["']/gi)) {
		dataAttrs.push(m[0]);
	}

	return { html, scriptSrcs, metaTags, inlineScripts, htmlLinks, dataAttrs };
}

function matchRule(
	rule: DetectionRule,
	data: StaticData,
	targetHostname: string,
): { matched: boolean; evidence: string } {
	switch (rule.vector) {
		case "header": {
			if (rule.check?.(data.headers)) {
				return {
					matched: true,
					evidence: headerEvidence(rule, data.headers),
				};
			}
			return { matched: false, evidence: "" };
		}
		case "cookie": {
			if (rule.check?.(data.cookies)) {
				return { matched: true, evidence: "cookie match" };
			}
			if (rule.pattern) {
				const match = Object.keys(data.cookies).find((k) =>
					rule.pattern!.test(k),
				);
				if (match) return { matched: true, evidence: `cookie: ${match}` };
			}
			return { matched: false, evidence: "" };
		}
		case "script_src": {
			if (rule.domains) {
				for (const src of data.scriptSrcs) {
					for (const domain of rule.domains) {
						if (src.includes(domain)) {
							return { matched: true, evidence: src };
						}
					}
				}
			}
			if (rule.pattern) {
				for (const src of data.scriptSrcs) {
					if (rule.pattern.test(src)) {
						return { matched: true, evidence: src };
					}
				}
			}
			return { matched: false, evidence: "" };
		}
		case "meta_tag": {
			if (rule.pattern) {
				for (const tag of data.metaTags) {
					if (rule.pattern.test(tag)) {
						return { matched: true, evidence: tag };
					}
				}
			}
			return { matched: false, evidence: "" };
		}
		case "inline_script": {
			if (rule.pattern) {
				for (const script of data.inlineScripts) {
					if (rule.pattern.test(script)) {
						const snippet = script
							.substring(0, 80)
							.replace(/\s+/g, " ")
							.trim();
						return {
							matched: true,
							evidence: snippet + (script.length > 80 ? "..." : ""),
						};
					}
				}
			}
			return { matched: false, evidence: "" };
		}
		case "html_link": {
			if (rule.pattern) {
				for (const link of data.htmlLinks) {
					// Skip links pointing at the target site itself
					try {
						const linkHost = new URL(link, `https://${targetHostname}`).hostname;
						if (linkHost === targetHostname) continue;
					} catch {
						// relative links that don't parse — skip them
						if (link.startsWith("/") || link.startsWith("#")) continue;
					}
					if (rule.pattern.test(link)) {
						return { matched: true, evidence: link };
					}
				}
			}
			return { matched: false, evidence: "" };
		}
		case "data_attr": {
			if (rule.pattern) {
				for (const attr of data.dataAttrs) {
					if (rule.pattern.test(attr)) {
						return { matched: true, evidence: attr };
					}
				}
			}
			return { matched: false, evidence: "" };
		}
		default:
			return { matched: false, evidence: "" };
	}
}

export async function runTier1(
	url: string,
	signatures: ToolSignature[],
	timeout = 10_000,
): Promise<RuleMatch[]> {
	const matches: RuleMatch[] = [];

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(url, {
			signal: controller.signal,
			redirect: "follow",
			headers: {
				"User-Agent":
					"Mozilla/5.0 (compatible; TechStackDetector/1.0)",
			},
		});

		const headers: Record<string, string> = {};
		response.headers.forEach((v, k) => {
			headers[k.toLowerCase()] = v;
		});

		const cookies: Record<string, string> = {};
		const setCookie = response.headers.getSetCookie?.() ?? [];
		for (const c of setCookie) {
			const [pair] = c.split(";");
			if (pair) {
				const [name, ...valueParts] = pair.split("=");
				if (name) cookies[name.trim()] = valueParts.join("=");
			}
		}

		const html = await response.text();
		const parsed = parseHtml(html);
		const data: StaticData = { headers, cookies, ...parsed };
		const targetHostname = new URL(url).hostname;

		for (const sig of signatures) {
			for (const rule of sig.rules) {
				if (rule.tier !== 1) continue;

				const result = matchRule(rule, data, targetHostname);
				if (result.matched) {
					matches.push({
						toolId: sig.id,
						vector: rule.vector,
						tier: 1,
						confidence: rule.confidence,
						evidence: result.evidence,
					});
				}
			}
		}
	} catch (err) {
		if ((err as Error).name !== "AbortError") {
			console.error(`[tier1] fetch failed: ${(err as Error).message}`);
		}
	} finally {
		clearTimeout(timer);
	}

	return matches;
}
