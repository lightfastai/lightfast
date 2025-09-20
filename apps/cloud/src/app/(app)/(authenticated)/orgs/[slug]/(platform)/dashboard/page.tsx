import { auth } from "@clerk/nextjs/server";
import { Button } from "@repo/ui/components/ui/button";
import { Plus, Sparkles, Key } from "lucide-react";
import Link from "next/link";
import { GoodAfternoon } from "./_components/good-afternoon";
import { AgentList } from "./_components/agent-list";

interface DashboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { orgId } = await auth();
  const { slug: orgSlug } = await params;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <GoodAfternoon />

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-6 bg-card border-border hover:bg-muted/50 text-foreground"
            asChild
          >
            <Link href={`/orgs/${orgSlug}/agents/create`}>
              <Plus className="w-5 h-5 mr-3" />
              Create an agent
            </Link>
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-6 bg-card border-border hover:bg-muted/50 text-foreground"
            asChild
          >
            <Link href={`/orgs/${orgSlug}/agents/generate`}>
              <Sparkles className="w-5 h-5 mr-3" />
              Generate an agent
            </Link>
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-6 bg-card border-border hover:bg-muted/50 text-foreground"
            asChild
          >
            <Link href={`/orgs/${orgSlug}/settings/api-keys`}>
              <Key className="w-5 h-5 mr-3" />
              Get API Key
            </Link>
          </Button>
        </div>

        {/* Agents List */}
        <AgentList />
      </div>
    </div>
  );
}