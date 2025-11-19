"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Github, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { useToast } from "@repo/ui/hooks/use-toast";
import { useTRPC } from "@repo/console-trpc/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";

/**
 * Import Configuration Page
 *
 * After user selects a repository to import, they land here to configure:
 * - Project name
 * - Team/organization
 * - Framework preset (detect from lightfast.yml)
 * - Root directory
 * - Build settings
 * - Environment variables
 */

export default function ImportPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { organization } = useOrganization();
  const trpc = useTRPC();
  const { toast } = useToast();

  // Extract query params
  const repoId = searchParams.get("id");
  const repoName = searchParams.get("name");
  const repoOwner = searchParams.get("owner");
  const installationId = searchParams.get("installationId");
  const teamSlug = searchParams.get("teamSlug");
  const repoUrl = searchParams.get("s");

  // Form state
  const [projectName, setProjectName] = useState(searchParams.get("project-name") || "");
  const [framework, setFramework] = useState("other");
  const [rootDirectory, setRootDirectory] = useState("./");
  const [configStatus, setConfigStatus] = useState<
    "loading" | "found" | "not-found" | "error"
  >("loading");
  const [configPath, setConfigPath] = useState<string | null>(null);
  const [configContent, setConfigContent] = useState<string | null>(null);

  // Get user's GitHub integration
  const { data: githubIntegration, isLoading: isLoadingIntegration } = useQuery(
    trpc.integration.github.list.queryOptions()
  );

  // Detect lightfast.yml configuration using tRPC
  const { data: configData, isLoading: isLoadingConfig, isError: isConfigError } = useQuery({
    ...trpc.integration.github.detectConfig.queryOptions({
      integrationId: githubIntegration?.id ?? "",
      installationId: installationId ?? "",
      fullName: `${repoOwner}/${repoName}`,
    }),
    enabled: Boolean(githubIntegration?.id && installationId && repoOwner && repoName),
  });

  // Update config status based on query result
  useEffect(() => {
    if (isLoadingConfig) {
      setConfigStatus("loading");
    } else if (isConfigError) {
      setConfigStatus("error");
    } else if (configData?.exists && configData.path && configData.content) {
      setConfigStatus("found");
      setConfigPath(configData.path);
      setConfigContent(configData.content);

      // Try to parse framework from config (basic YAML parsing)
      if (configData.content.includes("framework:")) {
        const frameworkMatch = configData.content.match(
          /framework:\s*["']?(\w+)["']?/
        );
        if (frameworkMatch?.[1]) {
          setFramework(frameworkMatch[1].toLowerCase());
        }
      }
    } else {
      setConfigStatus("not-found");
    }
  }, [configData, isLoadingConfig, isConfigError]);

  // Resolve workspace from organization
  const { data: workspace, isLoading: isLoadingWorkspace } = useQuery({
    ...trpc.workspace.resolveFromClerkOrgId.queryOptions({
      clerkOrgId: organization?.id ?? "",
    }),
    enabled: Boolean(organization?.id),
  });

  // Create integration resource mutation
  const createResourceMutation = useMutation(
    trpc.integration.resources.create.mutationOptions({
      onError: (error) => {
        toast({
          title: "Failed to create resource",
          description: error.message ?? "Failed to create integration resource. Please try again.",
          variant: "destructive",
        });
      },
    })
  );

  // Connect resource to workspace mutation
  const connectWorkspaceMutation = useMutation(
    trpc.integration.workspace.connect.mutationOptions({
      onSuccess: (data) => {
        toast({
          title: "Repository connected!",
          description: `${repoName} has been successfully connected.`,
        });

        // Redirect to organization dashboard
        router.push(`/org/${organization?.slug ?? teamSlug}`);
      },
      onError: (error) => {
        toast({
          title: "Connection failed",
          description: error.message ?? "Failed to connect repository. Please try again.",
          variant: "destructive",
        });
      },
    })
  );

  const handleImport = async () => {
    if (!organization?.id) {
      toast({
        title: "Organization required",
        description: "Please select an organization first.",
        variant: "destructive",
      });
      return;
    }

    if (!repoId || !installationId || !repoName || !repoOwner) {
      toast({
        title: "Missing information",
        description: "Repository information is incomplete.",
        variant: "destructive",
      });
      return;
    }

    if (!githubIntegration?.id) {
      toast({
        title: "GitHub not connected",
        description: "Please connect your GitHub account first.",
        variant: "destructive",
      });
      return;
    }

    if (!workspace?.workspaceId) {
      toast({
        title: "Workspace not found",
        description: "Failed to resolve workspace for this organization.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Create integration resource
      const resource = await createResourceMutation.mutateAsync({
        integrationId: githubIntegration.id,
        installationId: installationId,
        repoId: repoId,
        repoName: repoName,
        repoFullName: `${repoOwner}/${repoName}`,
        defaultBranch: "main", // TODO: fetch from GitHub API or config detection
        isPrivate: false, // TODO: fetch from GitHub API
        isArchived: false, // TODO: fetch from GitHub API
      });

      if (!resource) {
        throw new Error("Failed to create resource");
      }

      // Step 2: Connect resource to workspace with sync config
      await connectWorkspaceMutation.mutateAsync({
        workspaceId: workspace.workspaceId,
        resourceId: resource.id,
        syncConfig: {
          branches: ["main"], // Default to main branch
          paths: ["**/*"], // Default to all files
          events: [], // TODO: configure events if needed
          autoSync: true,
        },
      });
    } catch (error) {
      console.error("Import failed:", error);
      // Error handling is done in mutation callbacks
    }
  };

  return (
    <div className="min-h-screen bg-background py-16">
      <div className="mx-auto max-w-2xl px-4">
        {/* Header */}
        <h1 className="mb-8 text-3xl font-bold">New Project</h1>

        {/* Importing from GitHub */}
        <div className="mb-8 rounded-lg border bg-card p-6">
          <p className="mb-3 text-sm text-muted-foreground">Importing from GitHub</p>
          <div className="flex items-center gap-2 mb-4">
            <Github className="h-5 w-5" />
            <span className="font-medium">{repoOwner}/{repoName}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">main</span>
          </div>

          {/* Config Detection Status */}
          {configStatus === "loading" && (
            <div className="text-sm text-muted-foreground">
              Detecting configuration...
            </div>
          )}
          {configStatus === "found" && configPath && (
            <div className="text-sm text-green-600 dark:text-green-500">
              ✓ Found {configPath}
            </div>
          )}
          {configStatus === "not-found" && (
            <div className="text-sm text-amber-600 dark:text-amber-500">
              ⚠ No lightfast.yml found - using default configuration
            </div>
          )}
          {configStatus === "error" && (
            <div className="text-sm text-red-600 dark:text-red-500">
              ✗ Failed to detect configuration
            </div>
          )}
        </div>

        {/* Configuration Form */}
        <div className="space-y-6">
          <p className="text-sm">
            Choose where you want to create the project and give it a name.
          </p>

          {/* Team & Project Name */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="team">Vercel Team</Label>
              <Input id="team" value={teamSlug || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="my-project"
              />
            </div>
          </div>

          {/* Framework Preset */}
          <div className="space-y-2">
            <Label htmlFor="framework">Framework Preset</Label>
            <Select value={framework} onValueChange={setFramework}>
              <SelectTrigger id="framework">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="nextjs">Next.js</SelectItem>
                <SelectItem value="react">React</SelectItem>
                <SelectItem value="vue">Vue</SelectItem>
                <SelectItem value="vite">Vite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Root Directory */}
          <div className="space-y-2">
            <Label htmlFor="root-dir">Root Directory</Label>
            <div className="flex gap-2">
              <Input
                id="root-dir"
                value={rootDirectory}
                onChange={(e) => setRootDirectory(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline">Edit</Button>
            </div>
          </div>

          {/* Build and Output Settings */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                <ChevronRight className="mr-2 h-4 w-4" />
                Build and Output Settings
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4 pl-6">
              <p className="text-sm text-muted-foreground">
                Configure build settings here (coming soon)
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* Environment Variables */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                <ChevronRight className="mr-2 h-4 w-4" />
                Environment Variables
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4 pl-6">
              <p className="text-sm text-muted-foreground">
                Add environment variables here (coming soon)
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={
              !projectName ||
              createResourceMutation.isPending ||
              connectWorkspaceMutation.isPending ||
              isLoadingIntegration ||
              isLoadingWorkspace
            }
            className="w-full"
            size="lg"
          >
            {createResourceMutation.isPending || connectWorkspaceMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {createResourceMutation.isPending ? "Creating resource..." : "Connecting to workspace..."}
              </>
            ) : (
              "Import"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
