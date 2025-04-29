import { NextRequest, NextResponse } from "next/server";

import { nanoid } from "@repo/lib";

import { inngest } from "~/app/(inngest)/api/inngest/_client/client";
import { createClient } from "~/lib/supabase-client";
import { Database } from "~/types/supabase.types";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { prompt, engine } = body as {
    prompt: string;
    engine: Database["public"]["Tables"]["resource"]["Row"]["engine"];
  };

  // Insert resource with status 'pending'
  const { data, error } = await createClient()
    .from("resource")
    .insert({
      id: nanoid(),
      data: { prompt },
      engine,
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
    data: { id: data.id, prompt },
  });

  return NextResponse.json(
    { id: data.id, status: data.status },
    { status: 200 },
  );
}
