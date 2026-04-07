import { ShieldCheck } from "lucide-react";

export function SecurityNotice() {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium text-sm">Security Best Practices</h3>
      </div>
      <ul className="mt-3 list-inside list-disc space-y-1 text-muted-foreground text-sm">
        <li>Never commit API keys to version control</li>
        <li>Rotate keys regularly and after any suspected compromise</li>
        <li>
          Use separate keys for each environment (dev, staging, production)
        </li>
        <li>
          Store keys in a secret manager or encrypted environment variables
        </li>
        <li>
          Each key has full access to your organization's resources — treat them
          like passwords
        </li>
      </ul>
    </div>
  );
}
