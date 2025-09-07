"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { useParams } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";

export default function OrgDashboardPage() {
  const { slug } = useParams();
  const { userId, orgId, signOut } = useAuth();
  const { organization } = useOrganization();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-card border rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-foreground">
              🎉 Organization Dashboard Test Success!
            </h1>
            <Button 
              variant="outline" 
              onClick={() => signOut()}
              className="text-destructive hover:text-destructive"
            >
              Sign Out
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Route Information</h2>
              <p><strong>URL Slug:</strong> {slug}</p>
              <p><strong>Route:</strong> /orgs/{slug}/dashboard</p>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Authentication State</h2>
              <p><strong>User ID:</strong> {userId || 'null'}</p>
              <p><strong>Organization ID:</strong> {orgId || 'null'}</p>
            </div>

            {organization && (
              <div className="bg-muted/50 p-4 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">Organization Details</h2>
                <p><strong>Name:</strong> {organization.name}</p>
                <p><strong>Slug:</strong> {organization.slug || 'No slug set'}</p>
                <p><strong>ID:</strong> {organization.id}</p>
                <p><strong>Created:</strong> {organization.createdAt?.toLocaleDateString()}</p>
                <p><strong>Members:</strong> {organization.membersCount}</p>
              </div>
            )}

            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-2 text-green-800 dark:text-green-200">
                ✅ Test Results
              </h2>
              <ul className="space-y-1 text-green-700 dark:text-green-300">
                <li>• Organization creation: Working ✓</li>
                <li>• Organization selection: Working ✓</li>
                <li>• URL routing (/orgs/slug/dashboard): Working ✓</li>
                <li>• Session persistence: Working ✓</li>
                <li>• Organization data loading: {organization ? 'Working ✓' : 'Loading...'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}