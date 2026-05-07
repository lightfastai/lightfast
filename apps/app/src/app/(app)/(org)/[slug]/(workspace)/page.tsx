import { Card } from "@repo/ui/components/ui/card";

export default function OrgRootPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="max-w-md p-8 text-center">
        <h2 className="font-semibold text-lg">Workspace</h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Manage your team and API keys from the sidebar.
        </p>
      </Card>
    </div>
  );
}
