import type { ToolSignature } from "./types.js";

export const SIGNATURES: ToolSignature[] = [
	// ━━━ Engineering: Hosting / CDN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "vercel",
		name: "Vercel",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-vercel-id"] },
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => h.server === "Vercel" },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /vercel[-.]dns|\.vercel\.app/i },
			{ vector: "script_src", tier: 1, confidence: 0.8, domains: ["va.vercel-scripts.com"] },
		],
	},
	{
		id: "netlify",
		name: "Netlify",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-nf-request-id"] },
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => h.server === "Netlify" },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /netlify/i },
		],
	},
	{
		id: "cloudflare",
		name: "Cloudflare",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["cf-ray"] },
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => h.server === "cloudflare" },
			{ vector: "header", tier: 1, confidence: 0.85, check: (h) => !!h["cf-cache-status"] },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /\.cdn\.cloudflare\.net/i },
		],
	},
	{
		id: "cloudfront",
		name: "AWS CloudFront",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-amz-cf-id"] },
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => !!h["x-amz-cf-pop"] },
			{ vector: "header", tier: 1, confidence: 0.85, check: (h) => (h.via ?? "").includes("CloudFront") },
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => h.server === "CloudFront" },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /\.cloudfront\.net/i },
		],
	},
	{
		id: "fastly",
		name: "Fastly",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => (h.via ?? "").toLowerCase().includes("fastly") },
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => (h["x-served-by"] ?? "").includes("cache-") },
			{ vector: "dns_cname", tier: 2, confidence: 0.85, pattern: /\.fastly\.net/i },
		],
	},
	{
		id: "render",
		name: "Render",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-render-origin-server"] },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /\.onrender\.com/i },
		],
	},
	{
		id: "railway",
		name: "Railway",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => !!h["x-railway-request-id"] },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /\.railway\.app/i },
		],
	},
	{
		id: "flyio",
		name: "Fly.io",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["fly-request-id"] },
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => (h.server ?? "").startsWith("Fly/") },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /\.fly\.dev/i },
		],
	},
	{
		id: "heroku",
		name: "Heroku",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => (h.via ?? "").includes("vegur") },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /\.herokuapp\.com|\.herokussl\.com/i },
		],
	},
	{
		id: "github-pages",
		name: "GitHub Pages",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => h.server === "GitHub.com" },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /\.github\.io/i },
		],
	},
	{
		id: "firebase-hosting",
		name: "Firebase Hosting",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-firebase-hosting"] },
			{ vector: "dns_cname", tier: 2, confidence: 0.85, pattern: /\.firebaseapp\.com|\.web\.app/i },
		],
	},

	// ━━━ Engineering: Website Builders ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "webflow",
		name: "Webflow",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-wf-server"] },
			{ vector: "meta_tag", tier: 1, confidence: 0.9, pattern: /generator["'][^"']*Webflow/i },
			{ vector: "data_attr", tier: 1, confidence: 0.9, pattern: /data-wf-/i },
			{ vector: "script_src", tier: 1, confidence: 0.9, domains: ["assets-global.website-files.com", "assets.website-files.com"] },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /proxy-ssl\.webflow\.com/i },
		],
	},
	{
		id: "framer",
		name: "Framer",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-framer-render"] },
			{ vector: "script_src", tier: 1, confidence: 0.9, domains: ["framerusercontent.com", "events.framer.com"] },
			{ vector: "meta_tag", tier: 1, confidence: 0.9, pattern: /generator["'][^"']*Framer/i },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /framer/i },
		],
	},
	{
		id: "wordpress",
		name: "WordPress",
		category: "engineering",
		rules: [
			{ vector: "meta_tag", tier: 1, confidence: 0.95, pattern: /generator["'][^"']*WordPress/i },
			{ vector: "script_src", tier: 1, confidence: 0.9, pattern: /\/wp-content\/|\/wp-includes\// },
			{ vector: "html_link", tier: 1, confidence: 0.9, pattern: /\/wp-content\/|\/wp-includes\// },
			{ vector: "header", tier: 1, confidence: 0.85, check: (h) => (h["x-powered-by"] ?? "").includes("WP Engine") },
		],
	},
	{
		id: "squarespace",
		name: "Squarespace",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["static1.squarespace.com", "static.squarespace.com"] },
			{ vector: "meta_tag", tier: 1, confidence: 0.9, pattern: /generator["'][^"']*Squarespace/i },
			{ vector: "dns_cname", tier: 2, confidence: 0.9, pattern: /squarespace/i },
		],
	},
	{
		id: "wix",
		name: "Wix",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["static.parastorage.com", "static.wixstatic.com"] },
			{ vector: "meta_tag", tier: 1, confidence: 0.9, pattern: /generator["'][^"']*Wix/i },
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => h["x-wix-request-id"] !== undefined },
		],
	},
	{
		id: "shopify",
		name: "Shopify",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-shopify-stage"] || !!h["x-shopid"] },
			{ vector: "script_src", tier: 1, confidence: 0.9, domains: ["cdn.shopify.com"] },
			{ vector: "meta_tag", tier: 1, confidence: 0.9, pattern: /Shopify\.theme/i },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Shopify\.shop|Shopify\.theme|Shopify\.cdnHost/ },
		],
	},

	// ━━━ Engineering: Frameworks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "nextjs",
		name: "Next.js",
		category: "engineering",
		rules: [
			{ vector: "header", tier: 1, confidence: 0.95, check: (h) => !!h["x-nextjs-prerender"] || !!h["x-nextjs-cache"] },
			{ vector: "header", tier: 1, confidence: 0.9, check: (h) => !!h.rsc },
			{ vector: "meta_tag", tier: 1, confidence: 0.85, pattern: /next\.js/i },
			{ vector: "script_src", tier: 1, confidence: 0.9, pattern: /\/_next\// },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /__NEXT_DATA__/ },
		],
	},
	{
		id: "nuxtjs",
		name: "Nuxt.js",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, pattern: /\/_nuxt\// },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /__NUXT__|window\.__NUXT__/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "__NUXT__" },
			{ vector: "meta_tag", tier: 1, confidence: 0.85, pattern: /generator["'][^"']*Nuxt/i },
		],
	},
	{
		id: "remix",
		name: "Remix",
		category: "engineering",
		rules: [
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /__remixContext|window\.__remixManifest/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "__remixContext" },
			{ vector: "data_attr", tier: 1, confidence: 0.85, pattern: /data-remix/i },
		],
	},
	{
		id: "astro",
		name: "Astro",
		category: "engineering",
		rules: [
			{ vector: "meta_tag", tier: 1, confidence: 0.95, pattern: /generator["'][^"']*Astro/i },
			{ vector: "data_attr", tier: 1, confidence: 0.9, pattern: /astro-island/i },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /astro:/ },
		],
	},
	{
		id: "sveltekit",
		name: "SvelteKit",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.9, pattern: /\/__sveltekit\// },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /__sveltekit|__SVELTEKIT_/ },
			{ vector: "data_attr", tier: 1, confidence: 0.85, pattern: /data-sveltekit/i },
		],
	},
	{
		id: "gatsby",
		name: "Gatsby",
		category: "engineering",
		rules: [
			{ vector: "meta_tag", tier: 1, confidence: 0.95, pattern: /generator["'][^"']*Gatsby/i },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /___gatsby|window\.pagePath/ },
			{ vector: "script_src", tier: 1, confidence: 0.85, pattern: /\/page-data\// },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "___gatsby" },
		],
	},
	{
		id: "angular",
		name: "Angular",
		category: "engineering",
		rules: [
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /ng-version=|angular\.module|angular\.bootstrap/ },
			{ vector: "data_attr", tier: 1, confidence: 0.9, pattern: /ng-version/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "ng" },
		],
	},
	{
		id: "vuejs",
		name: "Vue.js",
		category: "engineering",
		rules: [
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Vue\.createApp|createApp\(|__vue__/ },
			{ vector: "data_attr", tier: 1, confidence: 0.85, pattern: /data-v-[a-f0-9]/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "__VUE__" },
		],
	},

	// ━━━ Engineering: Auth ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "clerk",
		name: "Clerk",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["clerk.com", "cdn.clerk.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /clerk\.com|ClerkProvider|clerkPublishableKey/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Clerk" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["clerk.com", "api.clerk.com", "api.clerk.dev"] },
		],
	},
	{
		id: "auth0",
		name: "Auth0",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.auth0.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /auth0-js|Auth0Lock|Auth0Client/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "auth0" },
			{ vector: "network_request", tier: 3, confidence: 0.85, pattern: /\.auth0\.com/ },
		],
	},
	{
		id: "stytch",
		name: "Stytch",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["js.stytch.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /stytch\.com|StytchProvider|stytchClient/i },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["api.stytch.com", "js.stytch.com"] },
		],
	},
	{
		id: "workos",
		name: "WorkOS",
		category: "engineering",
		rules: [
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /workos\.com|WorkOS\.init|AuthKitProvider/i },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["api.workos.com"] },
		],
	},

	// ━━━ Engineering: BaaS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "supabase",
		name: "Supabase",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.9, pattern: /supabase/ },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /supabase\.co|createClient.*supabase|SUPABASE_URL|NEXT_PUBLIC_SUPABASE/i },
			{ vector: "network_request", tier: 3, confidence: 0.9, pattern: /\.supabase\.co/ },
		],
	},
	{
		id: "firebase",
		name: "Firebase",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["www.gstatic.com/firebasejs"] },
			{ vector: "script_src", tier: 1, confidence: 0.9, pattern: /firebase/ },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /firebaseConfig|initializeApp.*firebase|firebase\.google\.com/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "firebase" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["firebaseinstallations.googleapis.com", "firestore.googleapis.com"] },
		],
	},

	// ━━━ Engineering: Error Tracking / APM ━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "sentry",
		name: "Sentry",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.9, domains: ["browser.sentry-cdn.com", "js.sentry-cdn.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Sentry\.init|dsn:\s*["']https:\/\/[^"']*@[^"']*\.ingest\.sentry\.io/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "__SENTRY__" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["sentry.io", "ingest.sentry.io"] },
		],
	},
	{
		id: "datadog",
		name: "Datadog",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.9, domains: ["www.datadoghq-browser-agent.com", "dd-cdn.com", "cdn.dd-cdn.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /datadogRum\.init|DD_RUM/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "DD_RUM" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["browser-intake-datadoghq.com", "rum.browser-intake-datadoghq.com"] },
		],
	},
	{
		id: "logrocket",
		name: "LogRocket",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.logrocket.io", "cdn.lr-ingest.io"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /LogRocket\.init/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "LogRocket" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["r.lr-ingest.io", "cdn.logrocket.io"] },
		],
	},
	{
		id: "bugsnag",
		name: "Bugsnag",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["d2wy8f7a9ursnm.cloudfront.net"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Bugsnag\.start|Bugsnag\.notify|bugsnag-js/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Bugsnag" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["sessions.bugsnag.com", "notify.bugsnag.com"] },
		],
	},
	{
		id: "newrelic",
		name: "New Relic",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["js-agent.newrelic.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /NREUM|newrelic\.com|nr-data\.net/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "NREUM" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["bam.nr-data.net", "js-agent.newrelic.com"] },
		],
	},

	// ━━━ Engineering: Search ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "algolia",
		name: "Algolia",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, pattern: /algolia/ },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /algoliasearch|algolia\.net|algolianet\.com/ },
			{ vector: "js_global", tier: 3, confidence: 0.85, global: "algoliasearch" },
			{ vector: "network_request", tier: 3, confidence: 0.9, pattern: /\.algolia\.net|\.algolianet\.com/ },
		],
	},

	// ━━━ Engineering: Image CDN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "cloudinary",
		name: "Cloudinary",
		category: "engineering",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.9, pattern: /cloudinary/ },
			{ vector: "html_link", tier: 1, confidence: 0.9, pattern: /res\.cloudinary\.com/i },
			{ vector: "network_request", tier: 3, confidence: 0.9, domains: ["res.cloudinary.com"] },
		],
	},
	{
		id: "imgix",
		name: "imgix",
		category: "engineering",
		rules: [
			{ vector: "html_link", tier: 1, confidence: 0.9, pattern: /\.imgix\.net/i },
			{ vector: "network_request", tier: 3, confidence: 0.9, pattern: /\.imgix\.net/ },
		],
	},

	// ━━━ Engineering: Misc ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "github",
		name: "GitHub",
		category: "engineering",
		rules: [
			{ vector: "html_link", tier: 1, confidence: 0.5, pattern: /github\.com\//i },
		],
	},

	// ━━━ Customer Support ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "intercom",
		name: "Intercom",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["widget.intercom.io", "js.intercomcdn.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /intercomSettings|Intercom\(['"]boot['"]/ },
			{ vector: "js_global", tier: 3, confidence: 0.95, global: "Intercom" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["api-iam.intercom.io", "widget.intercom.io", "nexus-websocket-a.intercom.io"] },
		],
	},
	{
		id: "zendesk",
		name: "Zendesk",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["static.zdassets.com", "ekr.zdassets.com", "cdn.zendesk.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /zE\(|zESettings|zdassets\.com/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "zE" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["ekr.zdassets.com", "static.zdassets.com"] },
		],
	},
	{
		id: "freshdesk",
		name: "Freshdesk",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["wchat.freshchat.com", "assetscdn-wchat.freshchat.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /fcWidget\.init|fcWidget\.open|freshchat\.com/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "fcWidget" },
		],
	},
	{
		id: "crisp",
		name: "Crisp",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["client.crisp.chat"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /CRISP_WEBSITE_ID|crisp\.chat/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "$crisp" },
		],
	},
	{
		id: "tawkto",
		name: "Tawk.to",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["embed.tawk.to"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /tawk\.to|Tawk_API/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Tawk_API" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["embed.tawk.to", "va.tawk.to"] },
		],
	},
	{
		id: "helpscout",
		name: "Help Scout",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["beacon-v2.helpscout.net"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /Beacon\(['"]init['"]|helpscout\.net/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Beacon" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["beacon-v2.helpscout.net", "d12wqas9hcki3z.cloudfront.net"] },
		],
	},
	{
		id: "drift",
		name: "Drift",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["js.driftt.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /drift\.load|driftt/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "drift" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["js.driftt.com", "event.api.driftt.com"] },
		],
	},
	{
		id: "plain",
		name: "Plain",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.9, domains: ["chat.plain.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /plain\.init|plainChat/i },
		],
	},
	{
		id: "pylon",
		name: "Pylon",
		category: "customer",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.9, domains: ["widget.usepylon.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Pylon\(["']chat/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Pylon" },
		],
	},

	// ━━━ Revenue / Payments ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "stripe",
		name: "Stripe",
		category: "revenue",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["js.stripe.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Stripe\(['"][ps]k_/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Stripe" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["js.stripe.com", "api.stripe.com", "m.stripe.com"] },
		],
	},
	{
		id: "paddle",
		name: "Paddle",
		category: "revenue",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.paddle.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Paddle\.Setup|Paddle\.Environment/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Paddle" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["cdn.paddle.com", "checkout.paddle.com"] },
		],
	},
	{
		id: "lemonsqueezy",
		name: "Lemon Squeezy",
		category: "revenue",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["assets.lemonsqueezy.com", "cdn.lemonsqueezy.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /lemonsqueezy\.com|createLemonSqueezy|LemonSqueezy\.setup/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "createLemonSqueezy" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["api.lemonsqueezy.com"] },
		],
	},
	{
		id: "chargebee",
		name: "Chargebee",
		category: "revenue",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["js.chargebee.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Chargebee\.init|js\.chargebee\.com/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Chargebee" },
		],
	},
	{
		id: "hubspot",
		name: "HubSpot",
		category: "revenue",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["js.hs-scripts.com", "js.hsforms.net", "js.hs-analytics.net", "js.hs-banner.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /hbspt\.forms|hs-script-loader|js\.hs-scripts\.com/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "HubSpotConversations" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["js.hs-scripts.com", "forms.hsforms.com", "api.hubspot.com"] },
		],
	},
	{
		id: "salesforce",
		name: "Salesforce (Pardot)",
		category: "revenue",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.85, domains: ["pi.pardot.com", "cdn.pardot.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.7, pattern: /pardot|piAId|piCId/i },
		],
	},

	// ━━━ Growth: Analytics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "google-analytics",
		name: "Google Analytics",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["www.googletagmanager.com", "www.google-analytics.com", "googletagmanager.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /gtag\(|GoogleAnalyticsObject|ga\(['"]create['"]/ },
			{ vector: "js_global", tier: 3, confidence: 0.85, global: "gtag" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["www.googletagmanager.com", "www.google-analytics.com", "analytics.google.com"] },
		],
	},
	{
		id: "posthog",
		name: "PostHog",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["us.i.posthog.com", "eu.i.posthog.com", "app.posthog.com", "us-assets.i.posthog.com", "eu-assets.i.posthog.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /posthog\.init|PostHogProvider|posthog-js/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "posthog" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["us.i.posthog.com", "eu.i.posthog.com", "app.posthog.com"] },
		],
	},
	{
		id: "mixpanel",
		name: "Mixpanel",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.mxpnl.com", "cdn4.mxpnl.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /mixpanel\.init|mixpanel\.track/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "mixpanel" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["api.mixpanel.com", "api-js.mixpanel.com", "cdn.mxpnl.com"] },
		],
	},
	{
		id: "amplitude",
		name: "Amplitude",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.amplitude.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /amplitude\.init|amplitude\.getInstance/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "amplitude" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["api.amplitude.com", "api2.amplitude.com", "cdn.amplitude.com"] },
		],
	},
	{
		id: "segment",
		name: "Segment",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.segment.com", "cdn.segment.io"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /analytics\.load\(|analytics\.identify\(|analytics\.track\(/ },
			{ vector: "js_global", tier: 3, confidence: 0.5, global: "analytics" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["api.segment.io", "cdn.segment.com", "api.segment.com"] },
		],
	},
	{
		id: "plausible",
		name: "Plausible",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["plausible.io"] },
			{ vector: "script_src", tier: 1, confidence: 0.9, pattern: /plausible[^"']*\.js/ },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /plausible\.io|plausible\.js/ },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["plausible.io"] },
		],
	},
	{
		id: "heap",
		name: "Heap",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.heapanalytics.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /heap\.load|heapanalytics/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "heap" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["heapanalytics.com", "cdn.heapanalytics.com"] },
		],
	},
	{
		id: "june",
		name: "June.so",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["analytics.june.so"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /june\.so|june\.init/i },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["analytics.june.so", "api.june.so"] },
		],
	},
	{
		id: "koala",
		name: "Koala",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.getkoala.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /getkoala\.com|koala\.init/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "ko" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["cdn.getkoala.com", "api2.getkoala.com"] },
		],
	},
	{
		id: "customerio",
		name: "Customer.io",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["assets.customer.io"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /_cio\.identify|_cio\.track|customer\.io/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "_cio" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["track.customer.io", "assets.customer.io"] },
		],
	},
	{
		id: "rudderstack",
		name: "RudderStack",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.rudderlabs.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /rudderanalytics\.load|rudderlabs\.com/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "rudderanalytics" },
			{ vector: "network_request", tier: 3, confidence: 0.85, pattern: /\.rudderlabs\.com|\.rudderstack\.com/ },
		],
	},
	{
		id: "rewardful",
		name: "Rewardful",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["r.wdfl.co"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /rewardful|r\.wdfl\.co/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Rewardful" },
		],
	},

	// ━━━ Growth: Feature Flags / Experimentation ━━━━━━━━━━━━━━━━━━
	{
		id: "statsig",
		name: "Statsig",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.statsig.com", "featuregates.org"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /statsig|StatsigProvider|statsig-node/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "statsig" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["featuregates.org", "api.statsig.com", "prodregistryv2.org"] },
		],
	},
	{
		id: "launchdarkly",
		name: "LaunchDarkly",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["clientsdk.launchdarkly.com", "app.launchdarkly.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /launchdarkly\.com|LDClient\.init/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "LDClient" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["clientsdk.launchdarkly.com", "events.launchdarkly.com", "app.launchdarkly.com"] },
		],
	},
	{
		id: "optimizely",
		name: "Optimizely",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.optimizely.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /optimizely\.com|window\.optimizely/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "optimizely" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["cdn.optimizely.com", "logx.optimizely.com"] },
		],
	},
	{
		id: "vwo",
		name: "VWO",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["dev.visualwebsiteoptimizer.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /visualwebsiteoptimizer|VWO/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "VWO" },
		],
	},

	// ━━━ Growth: Session Replay / Heatmaps ━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "hotjar",
		name: "Hotjar",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["static.hotjar.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /hotjar\.com|hj\(['"]init['"]/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "hj" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["static.hotjar.com", "vars.hotjar.com"] },
		],
	},
	{
		id: "fullstory",
		name: "FullStory",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["fullstory.com/s/fs.js", "edge.fullstory.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /FullStory|_fs_org/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "FS" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["rs.fullstory.com", "edge.fullstory.com"] },
		],
	},
	{
		id: "clarity",
		name: "Microsoft Clarity",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["www.clarity.ms"] },
			{ vector: "inline_script", tier: 1, confidence: 0.9, pattern: /clarity\.ms|clarity\(["']set["']/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "clarity" },
			{ vector: "network_request", tier: 3, confidence: 0.85, domains: ["www.clarity.ms"] },
		],
	},

	// ━━━ Growth: Email / Marketing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "mailchimp",
		name: "Mailchimp",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["chimpstatic.com", "list-manage.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /chimpstatic\.com|mc\.us\d+\.list-manage|mailchimp\.com/ },
		],
	},
	{
		id: "convertkit",
		name: "ConvertKit",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["f.convertkit.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /convertkit\.com|f\.convertkit\.com/ },
		],
	},

	// ━━━ Growth: Cookie Consent / Privacy ━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "onetrust",
		name: "OneTrust",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["cdn.cookielaw.org", "optanon.blob.core.windows.net"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /OneTrust|optanon/i },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "OneTrust" },
		],
	},
	{
		id: "cookiebot",
		name: "Cookiebot",
		category: "growth",
		rules: [
			{ vector: "script_src", tier: 1, confidence: 0.95, domains: ["consent.cookiebot.com"] },
			{ vector: "inline_script", tier: 1, confidence: 0.85, pattern: /Cookiebot\.|cookiebot\.com/ },
			{ vector: "js_global", tier: 3, confidence: 0.9, global: "Cookiebot" },
		],
	},

	// ━━━ Communication ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
	{
		id: "discord",
		name: "Discord",
		category: "communication",
		rules: [
			{ vector: "html_link", tier: 1, confidence: 0.7, pattern: /discord\.(gg|com\/invite)\//i },
			{ vector: "script_src", tier: 1, confidence: 0.85, domains: ["discord.com"] },
		],
	},
	{
		id: "slack",
		name: "Slack",
		category: "communication",
		rules: [
			{ vector: "html_link", tier: 1, confidence: 0.6, pattern: /slack\.com\//i },
		],
	},
];
