import { Icons } from "@repo/ui/components/icons";

/**
 * Workspace Creation Header
 * Server component - completely static, no interactivity
 */
export function WorkspaceHeader() {
  return (
    <>
      {/* Logo */}
      <div className="rounded-sm bg-card p-3 w-fit">
        <Icons.logoShort className="h-5 w-5 text-foreground" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl pb-4 font-pp font-medium text-foreground">
        Create a new workspace
      </h1>
    </>
  );
}
