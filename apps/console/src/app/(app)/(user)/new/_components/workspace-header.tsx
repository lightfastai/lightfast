import { Icons } from "@repo/ui/components/icons";

/**
 * Workspace Creation Header
 * Server component - completely static, no interactivity
 */
export function WorkspaceHeader() {
  return (
    <>
      {/* Logo */}
      <div className="w-fit rounded-sm bg-card p-3">
        <Icons.logoShort className="h-5 w-5 text-foreground" />
      </div>

      {/* Heading */}
      <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
        Create a new workspace
      </h1>
    </>
  );
}
