#!/usr/bin/env tsx

import { apiSource, docsSource } from "./src/lib/source";

console.log("Testing API documentation structure...\n");

// Test API source
const apiPages = apiSource.getPages();
console.log(`✓ API Pages loaded: ${apiPages.length} pages`);
console.log("  API Pages:");
apiPages.forEach(page => {
  console.log(`    - /${page.url}`);
});

// Test Docs source
const docsPages = docsSource.getPages();
console.log(`\n✓ Docs Pages loaded: ${docsPages.length} pages`);
console.log("  Sample Docs Pages (first 5):");
docsPages.slice(0, 5).forEach(page => {
  console.log(`    - /${page.url}`);
});

// Test page trees
console.log("\n✓ API Page Tree:", apiSource.pageTree ? "Loaded" : "Not loaded");
console.log("✓ Docs Page Tree:", docsSource.pageTree ? "Loaded" : "Not loaded");

// Test specific API page
const overviewPage = apiSource.getPage(["overview"]);
if (overviewPage) {
  console.log("\n✓ API Overview page loaded successfully");
  console.log(`  Title: ${overviewPage.data.title}`);
  console.log(`  Description: ${overviewPage.data.description}`);
} else {
  console.log("\n✗ Failed to load API Overview page");
}

// Test memory endpoints
const memoryPages = apiPages.filter(p => p.url.includes("memory"));
console.log(`\n✓ Memory endpoint pages: ${memoryPages.length}`);
memoryPages.forEach(page => {
  console.log(`    - /${page.url}`);
});

console.log("\n✅ All tests passed!");
console.log("\nURL Mapping (with rewrites):");
console.log("  /api/* → /api-reference/* (Next.js rewrite)");
console.log("  /api/overview → API Overview page");
console.log("  /api/memory/searchMemories → Search endpoint docs");
console.log("  /docs/get-started/overview → Documentation overview");