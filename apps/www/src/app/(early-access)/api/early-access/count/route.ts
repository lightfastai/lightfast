import { NextResponse } from "next/server";

import { log } from "@vendor/observability/log";

import { getEarlyAccessCountSafe } from "~/components/early-access/api/get-early-access-count";

export async function GET() {
  const result = await getEarlyAccessCountSafe({ logger: log });

  return result.match(
    (count) => {
      return NextResponse.json({ count }, { status: 200 });
    },
    (error) => {
      log.error("[API] Error fetching waitlist count:", { error });
      return NextResponse.json({ count: 0 }, { status: 500 });
    },
  );
}
