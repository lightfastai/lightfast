import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare/cloudflare-context";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { supabase } from "~/lib/supabase-client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { id, prompt } = body as { id: string; prompt: string };
  // Insert resource with status 'pending'
  const { data, error } = await supabase({
    supabaseUrl: getCloudflareContext().env.SUPABASE_URL,
    supabaseAnonKey: getCloudflareContext().env.SUPABASE_ANON_KEY,
  })
    .from("resource")
    .insert({
      id,
      data: { prompt },
      engine: "fal-ai/fast-sdxl",
      type: "image",
      status: "init",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Trigger Inngest workflow
  await inngest.send({
    name: "media-server/handle-create-image",
    data: { id, prompt },
  });

  return NextResponse.json({ id, status: "pending" }, { status: 200 });
}
