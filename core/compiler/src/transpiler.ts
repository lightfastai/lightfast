import { build } from 'esbuild';
import type {BuildOptions, BuildResult, Plugin} from 'esbuild';
import { existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

export interface TranspileOptions {
  /**
   * Path to the TypeScript file to compile
   */
  sourcePath: string;
  
  /**
   * Target ECMAScript version
   * @default 'es2022'
   */
  target?: string;
  
  /**
   * Output format
   * @default 'esm'
   */
  format?: 'esm' | 'cjs';
  
  /**
   * Whether to generate source maps
   * @default true
   */
  sourcemap?: boolean;
  
  /**
   * Whether to minify the output
   * @default false
   */
  minify?: boolean;
  
  /**
   * Custom esbuild plugins
   */
  plugins?: Plugin[];
  
  /**
   * External dependencies to exclude from bundling
   */
  external?: string[];
  
  /**
   * Base directory for resolving relative imports
   */
  baseDir?: string;

  /**
   * Whether to bundle dependencies or keep them as imports
   * @default false
   */
  bundle?: boolean;
}

export interface TranspileResult {
  /**
   * Compiled JavaScript code
   */
  code: string;
  
  /**
   * Source map content (if enabled)
   */
  sourcemap?: string;
  
  /**
   * Build warnings
   */
  warnings: string[];
  
  /**
   * Build errors
   */
  errors: string[];
  
  /**
   * Build metadata
   */
  metafile?: unknown;
}


/**
 * Transpiles a TypeScript file to JavaScript using esbuild
 */
export async function transpile(options: TranspileOptions): Promise<TranspileResult> {
  const {
    sourcePath,
    target = 'es2022',
    format = 'esm',
    sourcemap = true,
    minify = false,
    plugins = [],
    external: _external = [],
    baseDir: _baseDir = process.cwd(),
    bundle = false
  } = options;

  const resolvedSourcePath = resolve(sourcePath);
  
  if (!existsSync(resolvedSourcePath)) {
    return {
      code: '',
      warnings: [],
      errors: [`Source file not found: ${resolvedSourcePath}`]
    };
  }

  const buildOptions: BuildOptions = {
    entryPoints: [resolvedSourcePath],
    write: false,
    bundle, // Usually false for config files
    format,
    target,
    sourcemap: sourcemap ? 'inline' : false,
    minify,
    platform: 'node',
    metafile: true,
    // When bundling, use packages: 'external' to keep all imports external
    // This is the key setting that makes TypeScript transpilation work
    // without needing the packages to be installed
    ...(bundle ? {
      packages: 'external' as const
    } : {}),
    // Don't use plugins or extra options that might interfere with resolution
    plugins: [
      ...plugins
    ],
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.js': 'js',
      '.jsx': 'jsx'
    },
    // Don't use tsconfig as it might have moduleResolution settings
    // that interfere with our packages: 'external' approach
    // tsconfig: undefined,
    // Enable JSX if the file has .tsx extension
    jsx: resolvedSourcePath.endsWith('.tsx') ? 'automatic' : undefined
  };
  
  // Debug logging (only in DEBUG mode)
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.DEBUG === '1') {
    console.log('[transpiler] Build options:', {
      bundle,
      packages: (buildOptions as { packages?: string }).packages,
      platform: buildOptions.platform,
      entryPoint: resolvedSourcePath
    });
  }

  try {
    const result: BuildResult = await build(buildOptions);
    
    const warnings = result.warnings.map(warning => 
      `${warning.location?.file}:${warning.location?.line}:${warning.location?.column}: ${warning.text}`
    );
    
    const errors = result.errors.map(error => 
      `${error.location?.file}:${error.location?.line}:${error.location?.column}: ${error.text}`
    );

    if (result.errors.length > 0) {
      return {
        code: '',
        warnings,
        errors,
        metafile: result.metafile
      };
    }

    const output = result.outputFiles?.[0];
    if (!output) {
      return {
        code: '',
        warnings,
        errors: ['No output generated'],
        metafile: result.metafile
      };
    }

    // Get source map if available
    let sourcemapContent: string | undefined;
    if (sourcemap && result.outputFiles) {
      // Check if we have a separate source map file
      if (result.outputFiles.length > 1) {
        const sourcemapFile = result.outputFiles.find(file => file.path.endsWith('.map'));
        if (sourcemapFile) {
          sourcemapContent = new TextDecoder().decode(sourcemapFile.contents);
        }
      }
      // If no separate file, check if source map is inline
      if (!sourcemapContent && result.outputFiles[0]) {
        const code = new TextDecoder().decode(result.outputFiles[0].contents);
        const inlineMatch = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m);
        if (inlineMatch) {
          sourcemapContent = Buffer.from(inlineMatch[1], 'base64').toString('utf-8');
        }
      }
    }

    let code = new TextDecoder().decode(output.contents);
    
    // Add source map reference if sourcemap is enabled and available
    if (sourcemap && sourcemapContent) {
      code += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(sourcemapContent).toString('base64')}`;
    }

    // Debug logging for metafile (only in DEBUG mode)
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.DEBUG === '1' && result.metafile) {
      const metafileObj = result.metafile as { inputs?: Record<string, unknown> } | null | undefined;
      console.log('[transpiler] Metafile inputs:', Object.keys(metafileObj?.inputs ?? {}));
    }

    return {
      code,
      sourcemap: sourcemapContent,
      warnings,
      errors,
      metafile: result.metafile
    };
  } catch (error) {
    return {
      code: '',
      warnings: [],
      errors: [`Build failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  }
}

/**
 * Transpiles a TypeScript configuration file
 * Uses bundle: true with packages: 'external' to transpile TypeScript
 * while keeping all package imports external for runtime resolution
 */
export async function transpileConfig(configPath: string, options: Partial<TranspileOptions> = {}): Promise<TranspileResult> {
  const resolvedConfigPath = resolve(configPath);
  const baseDir = dirname(resolvedConfigPath);
  
  const transpileOptions: TranspileOptions = {
    sourcePath: resolvedConfigPath,
    baseDir,
    format: 'esm',
    target: 'es2022',
    bundle: true, // Must bundle to use packages: 'external'
    sourcemap: true,
    minify: false,
    ...options
  };
  
  const result = await transpile(transpileOptions);
  
  // If successful, ensure the code has proper ESM export structure
  if (result.code && result.errors.length === 0) {
    // Add helpful comment at the top
    const header = `// Generated by Lightfast CLI from ${relative(process.cwd(), resolvedConfigPath)}\n`;
    result.code = header + result.code;
    
    // Check for default export
    const hasDefaultExport = 
      result.code.includes('export default') || 
      result.code.includes('export {') && result.code.includes('as default') ||
      result.code.includes('module.exports');
      
    if (!hasDefaultExport) {
      result.warnings.push(`Config file ${configPath} doesn't have a default export. This may cause issues.`);
    }
  }
  
  return result;
}

/**
 * Quick utility to check if a file can be transpiled
 */
export function isTranspilable(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx)$/.test(filePath) && existsSync(filePath);
}

/**
 * Gets the output extension for a given input file
 */
export function getOutputExtension(_inputPath: string, format: 'esm' | 'cjs' = 'esm'): string {
  if (format === 'esm') {
    return '.mjs';
  } else {
    return '.cjs';
  }
}

/**
 * Validates TypeScript configuration file
 */
export async function validateConfig(configPath: string): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  if (!existsSync(configPath)) {
    return {
      isValid: false,
      errors: [`Configuration file not found: ${configPath}`],
      warnings: []
    };
  }

  // Basic syntax check by transpiling without output
  const result = await transpileConfig(configPath, {
    minify: false,
    sourcemap: false
  });

  return {
    isValid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings
  };
}