/**
 * Security Best Practices Notice (Server Component)
 *
 * Static security guidelines displayed at the bottom of the API key settings page.
 */
export function SecurityNotice() {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4">
      <h3 className="mb-2 font-medium text-foreground text-sm">
        Security Best Practices
      </h3>
      <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
        <li>
          Never share your API keys publicly or commit them to version control
        </li>
        <li>Rotate your keys regularly and revoke unused keys</li>
        <li>
          Use different keys for different environments (dev, staging,
          production)
        </li>
        <li>
          Store keys securely using environment variables or secret management
          tools
        </li>
        <li>
          Organization API keys are scoped to your organization for security
        </li>
      </ul>
    </div>
  );
}
