import dns from "node:dns/promises";
import type { RuleMatch, ToolSignature } from "../types.js";

async function resolveCnames(hostname: string): Promise<string[]> {
	try {
		return await dns.resolveCname(hostname);
	} catch {
		return [];
	}
}

async function resolveTxt(hostname: string): Promise<string[]> {
	try {
		const records = await dns.resolveTxt(hostname);
		return records.map((r) => r.join(""));
	} catch {
		return [];
	}
}

async function resolveA(hostname: string): Promise<string[]> {
	try {
		return await dns.resolve4(hostname);
	} catch {
		return [];
	}
}

async function fetchRobotsTxt(
	origin: string,
	timeout = 5_000,
): Promise<string> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		const res = await fetch(`${origin}/robots.txt`, {
			signal: controller.signal,
			redirect: "follow",
		});
		if (!res.ok) return "";
		return await res.text();
	} catch {
		return "";
	} finally {
		clearTimeout(timer);
	}
}

export async function runTier2(
	url: string,
	signatures: ToolSignature[],
): Promise<RuleMatch[]> {
	const matches: RuleMatch[] = [];
	const parsed = new URL(url);
	const hostname = parsed.hostname;
	const origin = parsed.origin;

	const [cnames, txtRecords, aRecords, robotsTxt] = await Promise.all([
		resolveCnames(hostname),
		resolveTxt(hostname),
		resolveA(hostname),
		fetchRobotsTxt(origin),
	]);

	const dnsData = {
		cnames,
		txtRecords,
		aRecords,
		robotsTxt,
	};

	for (const sig of signatures) {
		for (const rule of sig.rules) {
			if (rule.tier !== 2) continue;

			switch (rule.vector) {
				case "dns_cname": {
					if (rule.pattern) {
						for (const cname of dnsData.cnames) {
							if (rule.pattern.test(cname)) {
								matches.push({
									toolId: sig.id,
									vector: rule.vector,
									tier: 2,
									confidence: rule.confidence,
									evidence: `CNAME ${cname}`,
								});
							}
						}
					}
					break;
				}
				case "dns_txt": {
					if (rule.pattern) {
						for (const txt of dnsData.txtRecords) {
							if (rule.pattern.test(txt)) {
								matches.push({
									toolId: sig.id,
									vector: rule.vector,
									tier: 2,
									confidence: rule.confidence,
									evidence: `TXT ${txt.substring(0, 60)}`,
								});
							}
						}
					}
					break;
				}
				case "dns_a": {
					if (rule.pattern) {
						for (const a of dnsData.aRecords) {
							if (rule.pattern.test(a)) {
								matches.push({
									toolId: sig.id,
									vector: rule.vector,
									tier: 2,
									confidence: rule.confidence,
									evidence: `A ${a}`,
								});
							}
						}
					}
					break;
				}
				case "robots_txt": {
					if (rule.pattern && rule.pattern.test(dnsData.robotsTxt)) {
						matches.push({
							toolId: sig.id,
							vector: rule.vector,
							tier: 2,
							confidence: rule.confidence,
							evidence: "robots.txt match",
						});
					}
					break;
				}
			}
		}
	}

	return matches;
}
