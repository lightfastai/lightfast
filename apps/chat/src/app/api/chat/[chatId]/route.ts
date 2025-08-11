import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  // TODO: Get chat messages
  return NextResponse.json({ chatId: params.chatId });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  // TODO: Delete chat
  return NextResponse.json({ deleted: params.chatId });
}