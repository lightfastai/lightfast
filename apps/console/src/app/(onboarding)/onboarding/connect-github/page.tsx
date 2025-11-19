"use client";

import { useOrganization } from "@clerk/nextjs";
import { Github, GitlabIcon as GitLab } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";

/**
 * Onboarding Step 2: Connect Git Provider
 *
 * User connects their GitHub account via OAuth.
 * After successful connection, redirects to repository selection.
 *
 * Design: Clean provider selection following Vercel's integration style.
 */
export default function ConnectGitHubPage() {
  const { organization } = useOrganization();

  const handleConnectGitHub = () => {
    // Get org slug for redirect after GitHub auth
    const orgSlug = organization?.slug;
    if (!orgSlug) {
      console.error("No organization found in session");
      return;
    }

    // Redirect to GitHub OAuth - callback will redirect to repository selection
    const callbackUrl = encodeURIComponent(
      `/org/${orgSlug}/settings/github-integration`,
    );
    window.location.href = `/api/github/install?callback=${callbackUrl}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Title */}
        <h1 className="text-center text-4xl font-bold tracking-tight">
          Let's connect
          <br />
          your Git provider
        </h1>

        {/* Provider Buttons */}
        <div className="space-y-3">
          {/* GitHub - Active */}
          <Button
            onClick={handleConnectGitHub}
            className="w-full justify-center gap-3 bg-[#24292e] text-white hover:bg-[#1a1e22] text-base font-medium"
            size="xl"
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </Button>

          {/* GitLab - Disabled */}
          <Button
            disabled
            className="w-full justify-center gap-3 bg-[#6e49cb] text-white opacity-40 text-base font-medium"
            size="xl"
          >
            <GitLab className="h-5 w-5" />
            Continue with GitLab
          </Button>

          {/* Bitbucket - Disabled */}
          <Button
            disabled
            className="w-full justify-center gap-3 bg-[#0052cc] text-white opacity-40 text-base font-medium"
            size="xl"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
            </svg>
            Continue with Bitbucket
          </Button>
        </div>

        {/* Skip link */}
        <div className="text-center">
          <Link
            href={organization?.slug ? `/org/${organization.slug}` : "/"}
            className="text-sm text-blue-500 hover:text-blue-600 transition-colors inline-flex items-center gap-1"
          >
            Skip →
          </Link>
        </div>
      </div>
    </div>
  );
}
