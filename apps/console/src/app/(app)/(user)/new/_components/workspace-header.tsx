/**
 * Workspace Creation Header
 * Server component - completely static, no interactivity
 */
export function WorkspaceHeader() {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold mb-2">Create a new workspace</h1>
      <p className="text-muted-foreground">
        Workspaces organize your team's knowledge and memory.{" "}
        <span className="text-xs italic">
          Required fields are marked with an asterisk (*).
        </span>
      </p>
    </div>
  );
}
