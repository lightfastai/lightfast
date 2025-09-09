import { auth } from "@clerk/nextjs/server";
import { Button } from "@repo/ui/components/ui/button";
import { Key } from "lucide-react";
import Link from "next/link";
import { EnhancedAgentList } from "./_components/enhanced-agent-list";

interface AgentPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AgentPage({ params }: AgentPageProps) {
  const { orgId } = await auth();
  const { slug: orgSlug } = await params;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Agents
              </h1>
              <p className="text-muted-foreground">
                Deploy and manage your AI agents
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-4"
                asChild
              >
                <Link href={`/orgs/${orgSlug}/settings/api-keys`}>
                  <Key className="w-4 h-4 mr-2" />
                  API Keys
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Agent List with Search and View Toggle */}
        <EnhancedAgentList />
      </div>
    </div>
  );
}