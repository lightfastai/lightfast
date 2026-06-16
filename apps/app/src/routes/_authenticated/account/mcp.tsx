import { createFileRoute } from "@tanstack/react-router";
import { UserMcpConnectionsClient } from "~/account/mcp-connections-client";

export const Route = createFileRoute("/_authenticated/account/mcp")({
  head: () => ({
    meta: [
      { title: "Account MCP Connections - Lightfast" },
      {
        name: "description",
        content: "Manage MCP clients authorized for your account.",
      },
    ],
  }),
  component: AccountMcpPage,
});

function AccountMcpPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8">
      <div>
        <h1 className="font-medium font-pp text-2xl text-foreground">
          MCP Connections
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage MCP clients authorized for your account.
        </p>
      </div>

      <UserMcpConnectionsClient />
    </div>
  );
}
