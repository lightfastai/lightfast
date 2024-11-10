"use client";

import { useParams } from "next/navigation";

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
    <div className="flex h-full flex-col space-y-4 p-4">
      <div className="rounded-lg border bg-card p-4">
        <h1 className="text-lg font-semibold">Project Details</h1>
        <div className="mt-2 space-y-2">
          <div>
            <span className="text-sm text-muted-foreground">Status: </span>
            <span className="text-sm font-medium">{project.status}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Prompt: </span>
            <span className="text-sm font-medium">{project.prompt}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Created: </span>
            <span className="text-sm font-medium">
              {new Date(project.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* {project.result && Object.keys(project.result).length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-semibold">Generation Result</h2>
          <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-sm">
            {JSON.stringify(project.result, null, 2)}
          </pre>
        </div>
      )} */}
    </div>
  );
}
