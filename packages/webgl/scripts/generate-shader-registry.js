#!/usr/bin/env node
import * as fs from "fs";
import { watch } from "fs/promises";
import { createRequire } from "module";
import * as path from "path";
import { fileURLToPath } from "url";
import { glob } from "glob";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Require for dynamic imports if needed
const require = createRequire(import.meta.url);

// Parse command line arguments
const args = process.argv.slice(2);
const watchMode = args.includes("--watch");
const verbose = args.includes("--verbose");

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
};

// Configuration
const SOURCE_DIR = path.resolve(__dirname, "../src");
const IMPL_DIR = path.join(SOURCE_DIR, "shaders/impl");
const OUTPUT_FILE = path.join(
  SOURCE_DIR,
  "generated/shader-registry.generated.ts",
);
const ENUM_FILE = path.join(SOURCE_DIR, "generated/shader-enum.generated.ts");
const HASH_FILE = path.join(SOURCE_DIR, "generated/.shader-registry-hash.json");

// Ensure the output directory exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(
    `${colors.green}✓${colors.reset} Created output directory: ${outputDir}`,
  );
}

// Console output helpers with color formatting
const format = {
  info: (message) => `${colors.blue}${message}${colors.reset}`,
  success: (message) => `${colors.green}✓ ${message}${colors.reset}`,
  warning: (message) => `${colors.yellow}⚠ ${message}${colors.reset}`,
  error: (message) => `${colors.red}✗ ${message}${colors.reset}`,
  header: (message) =>
    `${colors.bright}${colors.blue}${message}${colors.reset}`,
  highlight: (message) =>
    `${colors.bright}${colors.white}${message}${colors.reset}`,
  shader: (name, exportName) =>
    `${colors.magenta}${name}${colors.reset} (${colors.cyan}${exportName}${colors.reset})`,
  filePath: (file) => `${colors.dim}${file}${colors.reset}`,
};

// Logging helper - only logs when not in quiet mode
function log(message) {
  if (verbose) {
    console.log(message);
  }
}

/**
 * Calculate a simple content hash for determining if files have changed
 */
function calculateFilesHash(files) {
  try {
    // Get last modified timestamps for all shader files
    const fileStats = files.map((file) => {
      try {
        const stats = fs.statSync(file);
        return {
          file: path.relative(IMPL_DIR, file),
          mtime: stats.mtimeMs,
        };
      } catch {
        return { file: path.relative(IMPL_DIR, file), mtime: 0 };
      }
    });

    // Sort by filename to ensure consistent order
    fileStats.sort((a, b) => a.file.localeCompare(b.file));

    // Return hash data
    return {
      files: fileStats,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error(
      format.error(`Error calculating files hash: ${error.message}`),
    );
    return { files: [], timestamp: Date.now() };
  }
}

/**
 * Check if shader files have changed since last generation
 */
function haveFilesChanged(currentFiles) {
  try {
    // Try to read previous hash
    if (!fs.existsSync(HASH_FILE)) {
      return true; // No hash file, so assume changed
    }

    const previousHashData = JSON.parse(fs.readFileSync(HASH_FILE, "utf-8"));
    const currentHashData = calculateFilesHash(currentFiles);

    // Check if file list is different
    if (previousHashData.files.length !== currentHashData.files.length) {
      return true;
    }

    // Check if any file has changed timestamp
    for (let i = 0; i < currentHashData.files.length; i++) {
      const current = currentHashData.files[i];
      const previous = previousHashData.files.find(
        (f) => f.file === current.file,
      );

      if (!previous || previous.mtime !== current.mtime) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(
      format.error(`Error checking file changes: ${error.message}`),
    );
    return true; // On error, assume changed to be safe
  }
}

/**
 * Update the hash file with current files state
 */
function updateFilesHash(files) {
  try {
    const hashData = calculateFilesHash(files);
    fs.writeFileSync(HASH_FILE, JSON.stringify(hashData, null, 2));
  } catch (error) {
    console.error(format.error(`Error updating hash file: ${error.message}`));
  }
}

/**
 * Discover shader definitions in the impl directory
 */
function discoverShaders() {
  log(format.info(`Scanning for shaders in: ${IMPL_DIR}`));

  if (!fs.existsSync(IMPL_DIR)) {
    console.error(
      format.error(`Implementation directory not found: ${IMPL_DIR}`),
    );
    return { shaders: [], files: [] };
  }

  try {
    // Only look for implementation files in the impl directory
    const implFiles = glob.sync("**/*.ts", {
      cwd: IMPL_DIR,
      absolute: true,
      ignore: "**/*.test.ts", // Ignore test files
    });

    log(format.info(`Found ${implFiles.length} potential shader files.`));

    if (implFiles.length === 0) {
      console.warn(format.warning(`No shader files found in ${IMPL_DIR}.`));
      return { shaders: [], files: implFiles };
    }

    const results = [];
    const processingErrors = [];
    const foundShaderNames = new Set();
    const foundExportNames = new Set();

    for (const file of implFiles) {
      try {
        // Read the file content
        const content = fs.readFileSync(file, "utf-8");

        // Extract the shader name from SHADER_NAME constant
        const nameConstMatch = /const\s+SHADER_NAME\s*=\s*["'](\w+)["']/.exec(
          content,
        );

        // Look for shader definition pattern
        const shaderDefMatch =
          /export\s+const\s+(\w+(?:ShaderDefinition))\s*=/.exec(content);

        if (shaderDefMatch?.[1]) {
          const exportName = shaderDefMatch[1];
          let name;

          if (nameConstMatch?.[1]) {
            name = nameConstMatch[1];
          } else {
            // Extract from definition name
            const baseName = exportName.replace(/ShaderDefinition$/, "");
            // Convert camelCase to PascalCase if needed
            name = baseName.charAt(0).toUpperCase() + baseName.slice(1);

            console.warn(
              format.warning(
                `No SHADER_NAME constant found in ${format.filePath(path.basename(file))}. Derived name: "${name}"`,
              ),
            );
          }

          // Check for duplicate shader names
          if (foundShaderNames.has(name)) {
            console.error(
              format.error(
                `Duplicate shader name '${format.highlight(name)}' found in ${format.filePath(path.basename(file))}`,
              ),
            );
            console.error(
              format.error(
                `Each shader must have a unique SHADER_NAME constant.`,
              ),
            );
            processingErrors.push(`Duplicate shader name: ${name}`);
            continue;
          }
          foundShaderNames.add(name);

          // Create relative import path
          const relativePath = path
            .relative(outputDir, file)
            .replace(/\\/g, "/") // Normalize Windows paths
            .replace(/\.tsx?$/, ""); // Remove extension

          // Create a unique import alias if the export name is a duplicate
          let importAlias = exportName;
          if (foundExportNames.has(exportName)) {
            const fileSafeName = path
              .basename(file, ".ts")
              .replace(/[^a-zA-Z0-9]/g, "_"); // Replace non-alphanumeric with underscore
            importAlias = `${exportName}_${fileSafeName}`;
            console.warn(
              format.warning(
                `Duplicate export name '${format.highlight(exportName)}' found. Creating alias: ${format.highlight(importAlias)}`,
              ),
            );
          }
          foundExportNames.add(exportName);

          results.push({
            name,
            exportName,
            importAlias,
            importPath: relativePath,
          });

          log(
            `Discovered shader: ${format.shader(name, exportName)} from ${format.filePath(path.basename(file))}`,
          );
        } else {
          console.warn(
            format.warning(
              `No shader definition export found in ${format.filePath(path.basename(file))}`,
            ),
          );
        }
      } catch (error) {
        const errorMessage = `Error processing file ${file}: ${error instanceof Error ? error.message : String(error)}`;
        processingErrors.push(errorMessage);
        console.error(format.error(errorMessage));
      }
    }

    if (processingErrors.length > 0) {
      console.error(
        format.error(
          `\n${processingErrors.length} errors occurred while processing shader files.`,
        ),
      );
    }

    if (results.length === 0) {
      console.error(
        format.error(
          `No valid shader definitions found in ${implFiles.length} files.`,
        ),
      );
    }

    return { shaders: results, files: implFiles };
  } catch (error) {
    console.error(
      format.error(
        `Failed to scan for shader files: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return { shaders: [], files: [] };
  }
}

/**
 * Generate the enum file
 */
function generateEnumFile(shaders) {
  if (shaders.length === 0) {
    console.error(format.error("Cannot generate enum file with no shaders."));
    return false;
  }

  log(
    format.info(`Generating enum file with ${shaders.length} shader types...`),
  );

  try {
    const enumContent = `/**
 * GENERATED FILE - DO NOT EDIT DIRECTLY
 * Generated by generate-shader-registry.js
 * Generated on: ${new Date().toISOString()}
 */

import { z } from "zod";

export const $Shaders = z.enum([
${shaders.map((s) => `  "${s.name}",`).join("\n")}
]);

export type Shaders = z.infer<typeof $Shaders>;
`;

    fs.writeFileSync(ENUM_FILE, enumContent.trim());
    log(format.success(`Generated enum file: ${ENUM_FILE}`));
    return true;
  } catch (error) {
    console.error(
      format.error(`Failed to generate enum file: ${error.message}`),
    );
    return false;
  }
}

/**
 * Generate the registry file
 */
function generateRegistryFile(shaders) {
  if (shaders.length === 0) {
    console.error(
      format.error("Cannot generate registry file with no shaders."),
    );
    return false;
  }

  log(
    format.info(
      `Generating registry file with ${shaders.length} shader definitions...`,
    ),
  );

  try {
    // Import the base definitions from shader files
    const baseImports = shaders
      .map((shader) =>
        shader.importAlias === shader.exportName
          ? `import { ${shader.exportName} } from "${shader.importPath}";`
          : `import { ${shader.exportName} as ${shader.importAlias} } from "${shader.importPath}";`,
      )
      .join("\n");

    // Create map entries that adapt base definitions to registry definitions
    const mapEntries = shaders
      .map(
        (shader) =>
          `  ["${shader.name}", adaptToRegistryDefinition(${shader.importAlias}, "${shader.name}")]`,
      )
      .join(",\n");

    const content = `
/**
 * GENERATED FILE - DO NOT EDIT DIRECTLY
 * Generated by generate-shader-registry.js
 * Generated on: ${new Date().toISOString()}
 */

import type { ShaderSchema } from "../shaders/interfaces/shader-def";
import type { ShaderDefinition } from "../registry/interfaces/registry-shader-def";
import { adaptToRegistryDefinition } from "../registry/interfaces/registry-shader-def";
import type { Shaders } from "./shader-enum.generated";
${baseImports}

/**
 * Pre-populated shader registry map
 * This is automatically generated during build
 */
export const generatedShaderRegistry = new Map<Shaders, ShaderDefinition<ShaderSchema>>([
${mapEntries}
] as [Shaders, ShaderDefinition<ShaderSchema>][]);
`;

    fs.writeFileSync(OUTPUT_FILE, content.trim());
    log(
      format.success(
        `Generated registry file: ${format.filePath(OUTPUT_FILE)}`,
      ),
    );
    return true;
  } catch (error) {
    console.error(
      format.error(
        `Failed to generate registry file: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return false;
  }
}

/**
 * Run the generator once
 */
async function runGenerator() {
  try {
    const separator = `${colors.blue}════════════════════════════════════════════════════════${colors.reset}`;
    console.log(separator);
    console.log(format.header("⚡ SHADER REGISTRY GENERATOR"));
    console.log(separator);
    console.log(format.info("Discovering shaders..."));
    const { shaders, files } = discoverShaders();

    // Check if files have changed
    if (!haveFilesChanged(files)) {
      console.log(
        format.success("No shader files have changed. Skipping generation."),
      );
      console.log(separator);
      return true;
    }

    if (shaders.length === 0) {
      console.error(
        format.error("No shader definitions found. Generation aborted."),
      );
      console.log(separator);
      return false;
    } else {
      console.log(
        format.success(`\nFound ${shaders.length} shader definitions.`),
      );

      // Generate files
      const enumSuccess = generateEnumFile(shaders);
      const registrySuccess = generateRegistryFile(shaders);

      if (enumSuccess && registrySuccess) {
        console.log(
          format.success("\n✨ Shader registry generation complete!"),
        );
        console.log(separator);
        // Update hash after successful generation
        updateFilesHash(files);
        return true;
      } else {
        console.error(format.error("\n❌ Shader registry generation failed."));
        console.log(separator);
        return false;
      }
    }
  } catch (error) {
    console.error(
      format.error(
        `\nFATAL ERROR: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return false;
  }
}

/**
 * Watch for changes to shader files and regenerate
 */
async function watchForChanges() {
  const separator = `${colors.blue}════════════════════════════════════════════════════════${colors.reset}`;
  console.log(separator);
  console.log(format.header("🔍 SHADER REGISTRY WATCHER"));
  console.log(separator);
  console.log(
    format.info(`Watching for changes in ${format.filePath(IMPL_DIR)}...`),
  );
  console.log(format.info("Press Ctrl+C to stop watching"));
  console.log(separator);

  // Initial generation
  await runGenerator();

  try {
    // Start watching the directory
    const watcher = watch(IMPL_DIR, { recursive: true });

    for await (const event of watcher) {
      if (event.filename && event.filename.endsWith(".ts")) {
        console.log(separator);
        console.log(
          format.info(
            `\n📝 File change detected: ${format.highlight(event.filename)}`,
          ),
        );
        console.log(separator);

        // Wait a moment for the write to complete
        setTimeout(async () => {
          await runGenerator();
        }, 100);
      }
    }
  } catch (error) {
    console.error(format.error(`Watch error: ${error.message}`));
    // Fall back to non-watch mode
    process.exit(1);
  }
}

// Main execution
if (watchMode) {
  watchForChanges().catch((error) => {
    console.error(
      format.error(
        `\nFATAL ERROR: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exit(1);
  });
} else {
  runGenerator()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(
        format.error(
          `\nFATAL ERROR: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
      process.exit(1);
    });
}
