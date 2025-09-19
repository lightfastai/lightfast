import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

import { createCaller } from "~/trpc/server";
import { SharedSessionView } from "../_components/shared-session-view";

interface SharePageProps {
  params: Promise<{
    shareId: string;
  }>;
}

const fetchShare = cache(async (shareId: string) => {
  const caller = await createCaller();

  try {
    return await caller.share.get({ shareId });
  } catch (error) {
    console.error("[share/page] Failed to load share", error);
    return null;
  }
});

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { shareId } = await params;
  const data = await fetchShare(shareId);

  if (!data) {
    return {
      title: "Conversation not found",
    };
  }

  return {
    title: `${data.session.title} · Shared Conversation`,
    description: "Shared Lightfast conversation",
    openGraph: {
      title: `${data.session.title} · Shared Conversation`,
      description: "View this shared Lightfast chat session",
    },
  };
}

export default async function SharedConversationPage({ params }: SharePageProps) {
  const { shareId } = await params;
  const data = await fetchShare(shareId);

  if (!data) {
    notFound();
  }

  return <SharedSessionView {...data} />;
}
