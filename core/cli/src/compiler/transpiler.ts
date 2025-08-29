import { build, type BuildOptions, type BuildResult, type Plugin } from 'esbuild';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  metafile?: any;
}

/**
 * Creates an esbuild plugin for workspace package resolution
 */
function createWorkspaceResolver(): Plugin {
  return {
    name: 'workspace-resolver',
    setup(build) {
      // Handle workspace: protocol for pnpm workspaces
      build.onResolve({ filter: /^workspace:/ }, (args) => {
        const packageName = args.path.replace(/^workspace:/, '');
        
        // Try to resolve from node_modules first (hoisted packages)
        const nodeModulesPath = join(process.cwd(), 'node_modules', packageName);
        if (existsSync(join(nodeModulesPath, 'package.json'))) {
          return {
            path: nodeModulesPath,
            external: true
          };
        }
        
        // Try to resolve from workspace packages
        const workspacePaths = [
          join(process.cwd(), 'packages', packageName),
          join(process.cwd(), 'core', packageName),
          join(process.cwd(), 'apps', packageName),
        ];
        
        for (const workspacePath of workspacePaths) {
          if (existsSync(join(workspacePath, 'package.json'))) {
            return {
              path: workspacePath,
              external: true
            };
          }
        }
        
        // Fallback to external
        return {
          path: packageName,
          external: true
        };
      });
    }
  };
}

/**
 * Creates an esbuild plugin for handling TypeScript paths
 */
function createTypeScriptPathsPlugin(baseDir: string): Plugin {
  return {
    name: 'typescript-paths',
    setup(build) {
      // Try to load tsconfig.json for path mapping
      const tsconfigPath = join(baseDir, 'tsconfig.json');
      let paths: Record<string, string[]> = {};
      let baseUrl = baseDir;
      
      if (existsSync(tsconfigPath)) {
        try {
          const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
          if (tsconfig.compilerOptions?.paths) {
            paths = tsconfig.compilerOptions.paths;
          }
          if (tsconfig.compilerOptions?.baseUrl) {
            baseUrl = resolve(baseDir, tsconfig.compilerOptions.baseUrl);
          }
        } catch (error) {
          // Ignore tsconfig parsing errors
        }
      }
      
      // Handle path mapping
      build.onResolve({ filter: /.*/ }, (args) => {
        // Skip relative and absolute paths
        if (args.path.startsWith('.') || args.path.startsWith('/')) {
          return;
        }
        
        // Check if path matches any path mapping
        for (const [pattern, replacements] of Object.entries(paths)) {
          const regex = new RegExp(pattern.replace('*', '(.*)'));
          const match = args.path.match(regex);
          
          if (match) {
            for (const replacement of replacements) {
              const resolvedPath = resolve(
                baseUrl,
                replacement.replace('*', match[1] || '')
              );
              
              // Check for various file extensions
              const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs'];
              for (const ext of extensions) {
                const fullPath = resolvedPath + ext;
                if (existsSync(fullPath)) {
                  return { path: fullPath };
                }
              }
              
              // Check for index files
              const indexExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
              for (const ext of indexExtensions) {
                const indexPath = join(resolvedPath, `index${ext}`);
                if (existsSync(indexPath)) {
                  return { path: indexPath };
                }
              }
            }
          }
        }
      });
    }
  };
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
    external = [],
    baseDir = process.cwd(),
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

  // Default external dependencies for config files
  const defaultExternals = [
    'lightfast',
    '@lightfastai/core',
    'node:*',
    // Common Node.js built-ins
    'fs', 'path', 'url', 'util', 'crypto', 'os', 'events',
    // Common dependencies that should remain external
    'zod', 'typescript', 'esbuild'
  ];

  const buildOptions: BuildOptions = {
    entryPoints: [resolvedSourcePath],
    write: false,
    bundle: true, // Always bundle for config files to be self-contained
    format,
    target,
    sourcemap,
    minify,
    platform: 'node',
    metafile: true,
    external: bundle ? [...defaultExternals, ...external] : [], // Only use external if bundling
    plugins: [
      createWorkspaceResolver(),
      createTypeScriptPathsPlugin(baseDir),
      ...plugins
    ],
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.js': 'js',
      '.jsx': 'jsx'
    },
    tsconfig: join(baseDir, 'tsconfig.json'),
    // Enable JSX if the file has .tsx extension
    jsx: resolvedSourcePath.endsWith('.tsx') ? 'automatic' : undefined
  };

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
    if (sourcemap && result.outputFiles && result.outputFiles.length > 1) {
      const sourcemapFile = result.outputFiles.find(file => file.path.endsWith('.map'));
      if (sourcemapFile) {
        sourcemapContent = new TextDecoder().decode(sourcemapFile.contents);
      }
    }

    let code = new TextDecoder().decode(output.contents);
    
    // Add source map reference if sourcemap is enabled and available
    if (sourcemap && sourcemapContent) {
      code += `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(sourcemapContent).toString('base64')}`;
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
 * Transpiles a TypeScript configuration file and handles common config patterns
 */
export async function transpileConfig(configPath: string, options: Partial<TranspileOptions> = {}): Promise<TranspileResult> {
  const resolvedConfigPath = resolve(configPath);
  const baseDir = dirname(resolvedConfigPath);
  
  const transpileOptions: TranspileOptions = {
    sourcePath: resolvedConfigPath,
    baseDir,
    format: 'esm',
    target: 'es2022',
    bundle: true, // Enable bundling by default for configs
    sourcemap: true,
    external: [
      // Always external for config files
      'lightfast',
      '@lightfastai/*',
      'node:*'
    ],
    ...options
  };
  
  const result = await transpile(transpileOptions);
  
  // If successful, ensure the code has proper ESM export structure
  if (result.code && result.errors.length === 0) {
    // Add helpful comment at the top
    const header = `// Generated by Lightfast CLI from ${relative(process.cwd(), resolvedConfigPath)}\n`;
    result.code = header + result.code;
    
    // Ensure the config has a default export if it doesn't already
    if (!result.code.includes('export default') && !result.code.includes('module.exports')) {
      console.warn(`Warning: Config file ${configPath} doesn't have a default export. This may cause issues.`);
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
export function getOutputExtension(inputPath: string, format: 'esm' | 'cjs' = 'esm'): string {
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