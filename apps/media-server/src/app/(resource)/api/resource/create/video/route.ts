import { NextRequest, NextResponse } from "next/server";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { createClient } from "~/lib/supabase-client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, prompt } = body as { id: string; prompt: string };
  // Insert resource with status 'pending'
  const { data, error } = await createClient()
    .from("resource")
    .insert({
      id,
      data: { prompt },
      engine: "fal-ai/kling-video/v2/master/text-to-video",
      type: "video",
      status: "init",
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Trigger Inngest workflow
  await inngest.send({
    name: "media-server/handle-create-video",
    data: { id, prompt },
  });

  return NextResponse.json({ id, status: "pending" }, { status: 200 });
}
