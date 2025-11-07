// TODO: Re-enable after fixing MDX build issue
// import { apiSource } from "@/src/lib/source";
// import { createFromSource } from "fumadocs-core/search/server";

/**
 * API reference search endpoint
 *
 * This route handles search for API reference documentation.
 * Accessible at /api/search.
 *
 * TEMPORARY: Disabled due to build error with Fumadocs MDX processing
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Search temporarily disabled" });
}

