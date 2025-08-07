import { NextConfig } from "next";

type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>;
		}
	: T;

/**
 * Deep merges Next.js configurations, properly handling arrays and functions
 *
 * @param baseConfig - The base configuration (typically vendorConfig)
 * @param customConfig - The custom configuration to merge
 * @returns Merged configuration
 */
export function mergeNextConfig(
	baseConfig: NextConfig,
	customConfig: DeepPartial<NextConfig>,
): NextConfig {
	const merged: NextConfig = { ...baseConfig };

	// Handle rewrites
	if (customConfig.rewrites) {
		const baseRewrites = baseConfig.rewrites;
		const customRewrites = customConfig.rewrites;

		merged.rewrites = async () => {
			const base =
				typeof baseRewrites === "function"
					? await baseRewrites()
					: baseRewrites || [];
			const custom =
				typeof customRewrites === "function"
					? await customRewrites()
					: customRewrites || [];

			// Handle both array and object formats
			if (Array.isArray(base) && Array.isArray(custom)) {
				return [...base, ...custom];
			}

			// Handle object format with beforeFiles, afterFiles, fallback
			if (!Array.isArray(base) && !Array.isArray(custom)) {
				return {
					beforeFiles: [
						...(base.beforeFiles || []),
						...(custom.beforeFiles || []),
					],
					afterFiles: [
						...(base.afterFiles || []),
						...(custom.afterFiles || []),
					],
					fallback: [...(base.fallback || []), ...(custom.fallback || [])],
				};
			}

			// Mixed formats - convert to array
			const baseArray = Array.isArray(base)
				? base
				: [
						...(base.beforeFiles || []),
						...(base.afterFiles || []),
						...(base.fallback || []),
					];
			const customArray = Array.isArray(custom)
				? custom
				: [
						...(custom.beforeFiles || []),
						...(custom.afterFiles || []),
						...(custom.fallback || []),
					];

			return [...baseArray, ...customArray];
		};
	}

	// Handle redirects
	if (customConfig.redirects) {
		const baseRedirects = baseConfig.redirects;
		const customRedirects = customConfig.redirects;

		merged.redirects = async () => {
			const base =
				typeof baseRedirects === "function"
					? await baseRedirects()
					: baseRedirects || [];
			const custom =
				typeof customRedirects === "function"
					? await customRedirects()
					: customRedirects || [];

			return [...base, ...custom];
		};
	}

	// Handle headers
	if (customConfig.headers) {
		const baseHeaders = baseConfig.headers;
		const customHeaders = customConfig.headers;

		merged.headers = async () => {
			const base =
				typeof baseHeaders === "function"
					? await baseHeaders()
					: baseHeaders || [];
			const custom =
				typeof customHeaders === "function"
					? await customHeaders()
					: customHeaders || [];

			return [...base, ...custom];
		};
	}

	// Handle images
	if (customConfig.images) {
		merged.images = {
			...baseConfig.images,
			...customConfig.images,
		} as any; // Type assertion needed due to NextConfig image type complexity
		
		// Merge remotePatterns array
		if (customConfig.images.remotePatterns && merged.images) {
			merged.images.remotePatterns = [
				...(baseConfig.images?.remotePatterns || []),
				...(customConfig.images.remotePatterns || []),
			].filter(Boolean) as any;
		}
		
		// Merge domains array
		if (customConfig.images.domains && merged.images) {
			merged.images.domains = [
				...(baseConfig.images?.domains || []),
				...(customConfig.images.domains || []),
			].filter(Boolean) as string[];
		}
		
		// Merge loader config
		if (customConfig.images.loader && merged.images) {
			merged.images.loader = customConfig.images.loader;
		}
	}

	// Handle experimental
	if (customConfig.experimental) {
		// Simple merge without deep spread to avoid type complexity
		merged.experimental = Object.assign(
			{},
			baseConfig.experimental,
			customConfig.experimental
		) as any;
		
		// Merge optimizePackageImports array
		if (customConfig.experimental.optimizePackageImports && merged.experimental) {
			merged.experimental.optimizePackageImports = [
				...(baseConfig.experimental?.optimizePackageImports || []),
				...(customConfig.experimental.optimizePackageImports || []),
			].filter(Boolean) as string[];
		}
		
		// Merge serverActions.allowedOrigins
		if (customConfig.experimental.serverActions?.allowedOrigins && merged.experimental) {
			merged.experimental.serverActions = {
				...baseConfig.experimental?.serverActions,
				...customConfig.experimental.serverActions,
				allowedOrigins: [
					...(baseConfig.experimental?.serverActions?.allowedOrigins || []),
					...(customConfig.experimental.serverActions.allowedOrigins || []),
				].filter(Boolean) as string[],
			};
		}
	}

	// Handle transpilePackages
	if (customConfig.transpilePackages) {
		merged.transpilePackages = [
			...(baseConfig.transpilePackages || []),
			...(customConfig.transpilePackages || []),
		].filter(Boolean) as string[];
	}

	// Handle env
	if (customConfig.env) {
		merged.env = {
			...baseConfig.env,
			...customConfig.env,
		};
	}

	// Handle webpack
	if (customConfig.webpack) {
		const baseWebpack = baseConfig.webpack;
		const customWebpack = customConfig.webpack;

		merged.webpack = (config, options) => {
			let resultConfig = config;

			if (baseWebpack) {
				resultConfig = baseWebpack(resultConfig, options);
			}

			if (customWebpack && typeof customWebpack === 'function') {
				resultConfig = customWebpack(resultConfig, options);
			}

			return resultConfig;
		};
	}

	// Copy over simple properties
	const simpleProps: (keyof NextConfig)[] = [
		"reactStrictMode",
		"basePath",
		"assetPrefix",
		"poweredByHeader",
		"compress",
		"devIndicators",
		"generateEtags",
		"distDir",
		"generateBuildId",
		"cleanDistDir",
		"pageExtensions",
		"trailingSlash",
		"skipTrailingSlashRedirect",
		"skipMiddlewareUrlNormalize",
		"productionBrowserSourceMaps",
		"optimizeFonts",
		"swcMinify",
		"output",
		"staticPageGenerationTimeout",
		"crossOrigin",
		"serverRuntimeConfig",
		"publicRuntimeConfig",
		"outputFileTracing",
	];

	for (const prop of simpleProps) {
		if (customConfig[prop] !== undefined) {
			(merged as any)[prop] = customConfig[prop];
		}
	}

	// Handle typescript config
	if (customConfig.typescript) {
		merged.typescript = {
			...baseConfig.typescript,
			...customConfig.typescript,
		};
	}

	// Handle eslint config
	if (customConfig.eslint) {
		merged.eslint = {
			...baseConfig.eslint,
			...customConfig.eslint,
		} as any;

		// Merge dirs array
		if (customConfig.eslint.dirs && merged.eslint) {
			merged.eslint.dirs = [
				...(baseConfig.eslint?.dirs || []),
				...(customConfig.eslint.dirs || []),
			].filter(Boolean) as string[];
		}
	}

	// Handle i18n
	if (customConfig.i18n) {
		merged.i18n = {
			...baseConfig.i18n,
			...customConfig.i18n,
		} as any;

		// Merge locales array
		if (customConfig.i18n.locales && merged.i18n) {
			merged.i18n.locales = customConfig.i18n.locales as any;
		}

		// Merge domains array
		if (customConfig.i18n.domains && merged.i18n) {
			merged.i18n.domains = [
				...(baseConfig.i18n?.domains || []),
				...(customConfig.i18n.domains || []),
			].filter(Boolean) as any;
		}
	}

	return merged;
}

/**
 * Creates a Next.js configuration by merging vendor config with custom config
 *
 * @param customConfig - The custom configuration
 * @param baseConfig - The base configuration (defaults to vendorConfig)
 * @returns Merged configuration
 */
export function createNextConfig(
	customConfig: DeepPartial<NextConfig>,
	baseConfig?: NextConfig,
): NextConfig {
	const vendorConfig = baseConfig || require("./next-config-builder").config;
	return mergeNextConfig(vendorConfig, customConfig);
}