"use client";

import { useConnectForm } from "./connect-form-provider";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export function ResourcePicker() {
  const { provider, selectedResources, setSelectedResources } = useConnectForm();

  if (selectedResources.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center text-muted-foreground">
        <p>
          {provider === "github"
            ? "Select repositories from the section above"
            : "Select projects from the section above"}
        </p>
      </div>
    );
  }

  const handleRemove = (id: string) => {
    setSelectedResources(selectedResources.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-2">
        {selectedResources.length}{" "}
        {provider === "github" ? "repositor" : "project"}
        {selectedResources.length === 1 ? "y" : "ies"} selected
      </div>

      <div className="rounded-lg border border-border divide-y">
        {selectedResources.map((resource) => (
          <div
            key={resource.id}
            className="flex items-center justify-between p-3"
          >
            <div className="flex items-center gap-3">
              {provider === "github" ? (
                <IntegrationIcons.github className="h-5 w-5" />
              ) : (
                <IntegrationIcons.vercel className="h-5 w-5" />
              )}
              <span className="font-medium">
                {resource.fullName ?? resource.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleRemove(resource.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
