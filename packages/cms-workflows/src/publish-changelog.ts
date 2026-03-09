#!/usr/bin/env npx tsx

/**
 * Publish a changelog draft from thoughts/changelog/ to BaseHub CMS.
 *
 * Usage:
 *   pnpm publish:changelog -- <filepath>
 *
 * The script:
 * 1. Parses YAML frontmatter (structured to match ChangelogEntryInput)
 * 2. Checks for duplicate slug in BaseHub
 * 3. Creates the changelog entry via mutation
 * 4. Updates the local file status to 'published'
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { changelog } from "@vendor/cms";
import matter from "gray-matter";
import type { ChangelogEntryInput } from "./mutations/changelog.js";
import { createChangelogEntry } from "./mutations/changelog.js";

interface InternalFields {
  fact_checked_files?: string[];
  generated?: string;
  publishedAt?: string;
  source_prs?: string[];
  status: "draft" | "published";
}

interface ChangelogFrontmatter {
  _internal?: InternalFields;
  excerpt?: string;
  fixes?: string[];
  // Categorized sections (arrays in YAML, converted to newline-separated strings)
  improvements?: string[];
  infrastructure?: string[];
  patches?: string[];
  prefix: string;
  publishedAt?: string;
  seo?: {
    metaDescription?: string;
    focusKeyword?: string;
    secondaryKeyword?: string;
    faq?: { question: string; answer: string }[];
  };
  slug: string;
  title: string;
  tldr?: string;
}

/**
 * Convert array of strings to newline-separated bullet list for BaseHub
 */
function arrayToText(arr: string[] | undefined): string | undefined {
  if (!arr || arr.length === 0) {
    return undefined;
  }
  return arr.map((item) => `• ${item}`).join("\n");
}

async function main() {
  const filepath = process.argv[2];
  if (!filepath) {
    console.error(
      JSON.stringify({
        success: false,
        error: "Usage: pnpm publish:changelog -- <filepath>",
      })
    );
    process.exit(1);
  }

  const absolutePath = resolve(filepath);

  // Read and parse file
  let fileContent: string;
  try {
    fileContent = readFileSync(absolutePath, "utf-8");
  } catch {
    console.error(
      JSON.stringify({
        success: false,
        error: `File not found: ${absolutePath}`,
      })
    );
    process.exit(1);
  }

  const { data, content: body } = matter(fileContent);
  const frontmatter = data as ChangelogFrontmatter;

  // Validate required fields
  const required: (keyof ChangelogFrontmatter)[] = ["title", "prefix", "slug"];
  for (const field of required) {
    if (!frontmatter[field]) {
      console.error(
        JSON.stringify({
          success: false,
          error: `Missing required field: ${field}`,
        })
      );
      process.exit(1);
    }
  }

  // Check if already published
  if (frontmatter._internal?.status === "published") {
    console.error(
      JSON.stringify({
        success: false,
        error: `This changelog has already been published. Status is 'published'.`,
      })
    );
    process.exit(1);
  }

  // Check for duplicate slug in BaseHub
  const existing = await changelog.getEntryBySlug(frontmatter.slug);
  if (existing) {
    console.error(
      JSON.stringify({
        success: false,
        error: `Changelog with slug '${frontmatter.slug}' already exists in BaseHub. Use a different slug or delete the existing entry.`,
        existingEntry: {
          title: existing._title,
          slug: existing.slug,
        },
      })
    );
    process.exit(1);
  }

  // Extract internal fields and array fields that need conversion
  const {
    _internal,
    improvements,
    infrastructure,
    fixes,
    patches,
    ...publishData
  } = frontmatter;

  // Build input - frontmatter maps directly, just add body and convert arrays
  const input: ChangelogEntryInput = {
    ...publishData,
    body: body.trim(),
    // Convert arrays to newline-separated bullet lists
    improvements: arrayToText(improvements),
    infrastructure: arrayToText(infrastructure),
    fixes: arrayToText(fixes),
    patches: arrayToText(patches),
  };

  // Execute mutation
  console.error(`Publishing changelog: ${frontmatter.title}...`);
  const result = await createChangelogEntry(input);

  // Check if mutation succeeded
  const transaction = result.transaction as
    | { status: string; message?: string }
    | undefined;
  if (transaction?.status === "Failed") {
    console.error(
      JSON.stringify({
        success: false,
        error: `BaseHub mutation failed: ${transaction.message}`,
        result,
      })
    );
    process.exit(1);
  }

  // Update local file status only after successful mutation
  const updatedData: ChangelogFrontmatter = {
    ...frontmatter,
    _internal: {
      ...(_internal ?? { status: "draft" }),
      status: "published",
      publishedAt: new Date().toISOString(),
    },
  };
  const updatedContent = matter.stringify(body, updatedData);
  writeFileSync(absolutePath, updatedContent);

  // Output success
  console.log(
    JSON.stringify(
      {
        success: true,
        result,
        localFileUpdated: true,
        slug: frontmatter.slug,
        url: `https://lightfast.ai/changelog/${frontmatter.slug}`,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  process.exit(1);
});
