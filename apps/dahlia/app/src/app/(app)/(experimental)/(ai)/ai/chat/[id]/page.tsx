"use client";

import { useParams } from "next/navigation";

import { TextureAIGeneratorStateWrapper } from "~/components/texture-ai-gen-state-wrapper";
import { api } from "~/trpc/react";

export default function ChatPage() {
  const { id } = useParams();
  const { data: project, isLoading } = api.projects.get.useQuery({
    id: id as string,
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1">
        <TextureAIGeneratorStateWrapper />
      </div>
    </div>
  );
}
