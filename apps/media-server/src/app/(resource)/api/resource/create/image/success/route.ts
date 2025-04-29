import { NextRequest, NextResponse } from "next/server";

import { FalGenerateImageSuccessPayload } from "@repo/ai";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as FalGenerateImageSuccessPayload;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  await inngest.send({
    name: "media-server/resource-image-success",
    data: { id, data: { payload: body.payload } },
  });
  return NextResponse.json({ id }, { status: 200 });
}
