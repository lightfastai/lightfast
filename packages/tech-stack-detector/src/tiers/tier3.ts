import type { chromium as ChromiumType } from "playwright";
import type { RuleMatch, ToolSignature } from "../types.js";

export interface Tier3Result {
	matches: RuleMatch[];
	networkDomains: Set<string>;
}

export async function runTier3(
	url: string,
	signatures: ToolSignature[],
	timeout = 15_000,
): Promise<Tier3Result> {
	const matches: RuleMatch[] = [];

	const networkDomains = new Set<string>();

	let chromium: typeof ChromiumType;
	try {
		const pw = await import("playwright");
		chromium = pw.chromium;
	} catch {
		console.error("[tier3] playwright not available, skipping browser tier");
		return { matches, networkDomains };
	}

	let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
	try {
		browser = await chromium.launch({ headless: true });
	} catch (err) {
		console.error(`[tier3] browser launch failed: ${(err as Error).message}`);
		return { matches, networkDomains };
	}

	try {
		const context = await browser.newContext({
			userAgent:
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		});
		const page = await context.newPage();

		// Capture all outbound network request domains
		const networkUrls: string[] = [];
		page.on("request", (req) => {
			try {
				const reqUrl = new URL(req.url());
				networkDomains.add(reqUrl.hostname);
				networkUrls.push(req.url());
			} catch {
				// ignore invalid URLs
			}
		});

		await page.goto(url, {
			waitUntil: "networkidle",
			timeout,
		});

		// Collect JS globals to check
		const globalsToCheck: { toolId: string; global: string; confidence: number }[] = [];
		for (const sig of signatures) {
			for (const rule of sig.rules) {
				if (rule.tier !== 3) continue;
				if (rule.vector === "js_global" && rule.global) {
					globalsToCheck.push({
						toolId: sig.id,
						global: rule.global,
						confidence: rule.confidence,
					});
				}
			}
		}

		// Batch-check all globals in a single evaluate call
		const globalNames = globalsToCheck.map((g) => g.global);
		const globalResults = await page.evaluate((names: string[]) => {
			return names.map((name) => {
				try {

					return typeof eval(name) !== "undefined";
				} catch {
					return false;
				}
			});
		}, globalNames);

		for (let i = 0; i < globalsToCheck.length; i++) {
			if (globalResults[i]) {
				const g = globalsToCheck[i];
			if (!g) continue;
				matches.push({
					toolId: g.toolId,
					vector: "js_global",
					tier: 3,
					confidence: g.confidence,
					evidence: `window.${g.global} exists`,
				});
			}
		}

		// Read browser cookies
		const browserCookies = await context.cookies();
		const cookieMap: Record<string, string> = {};
		for (const c of browserCookies) {
			cookieMap[c.name] = c.value;
		}

		// Match tier-3 network_request and browser_cookie rules
		for (const sig of signatures) {
			for (const rule of sig.rules) {
				if (rule.tier !== 3) continue;

				if (rule.vector === "network_request") {
					if (rule.domains) {
						for (const domain of rule.domains) {
							if (networkDomains.has(domain)) {
								matches.push({
									toolId: sig.id,
									vector: "network_request",
									tier: 3,
									confidence: rule.confidence,
									evidence: `request to ${domain}`,
								});
								break;
							}
						}
					}
					if (rule.pattern) {
						for (const nUrl of networkUrls) {
							if (rule.pattern.test(nUrl)) {
								const urlObj = new URL(nUrl);
								matches.push({
									toolId: sig.id,
									vector: "network_request",
									tier: 3,
									confidence: rule.confidence,
									evidence: `request to ${urlObj.hostname}`,
								});
								break;
							}
						}
					}
				}

				if (rule.vector === "browser_cookie") {
					if (rule.check?.(cookieMap)) {
						matches.push({
							toolId: sig.id,
							vector: "browser_cookie",
							tier: 3,
							confidence: rule.confidence,
							evidence: "browser cookie match",
						});
					}
					if (rule.pattern) {
						const match = Object.keys(cookieMap).find((k) =>
							rule.pattern?.test(k),
						);
						if (match) {
							matches.push({
								toolId: sig.id,
								vector: "browser_cookie",
								tier: 3,
								confidence: rule.confidence,
								evidence: `browser cookie: ${match}`,
							});
						}
					}
				}
			}
		}

		await context.close();
	} catch (err) {
		console.error(`[tier3] browser error: ${(err as Error).message}`);
	} finally {
		await browser.close();
	}

	return { matches, networkDomains };
}
