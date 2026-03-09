import { Input } from "@repo/ui/components/ui/input";
import Link from "next/link";
import { joinEarlyAccessAction } from "../_actions/early-access";
import { CompanySizeIsland } from "./company-size-island";
import { SourcesIsland } from "./sources-island";
import { SubmitButton } from "./submit-button";

interface EarlyAccessFormServerProps {
  companySizeError?: string | null;
  emailError?: string | null;
  initialCompanySize: string;
  initialEmail: string;
  initialSources: string[];
  sourcesError?: string | null;
}

export function EarlyAccessFormServer({
  initialEmail,
  initialCompanySize,
  initialSources,
  emailError,
  companySizeError,
  sourcesError,
}: EarlyAccessFormServerProps) {
  return (
    <div className="w-full">
      <form action={joinEarlyAccessAction} className="space-y-4">
        {/* Email — pure server-rendered input */}
        <div className="space-y-2">
          <label
            className="font-medium text-muted-foreground text-xs"
            htmlFor="email"
          >
            Email address
          </label>
          <Input
            defaultValue={initialEmail}
            id="email"
            name="email"
            placeholder="name@company.com"
            type="email"
          />
          {emailError && (
            <p className="text-destructive text-sm">{emailError}</p>
          )}
        </div>

        {/* Company Size — client island (shadcn Select needs JS) */}
        <CompanySizeIsland
          defaultValue={initialCompanySize}
          error={companySizeError}
        />

        {/* Sources — client island (Popover+Command combobox) */}
        <SourcesIsland defaultSources={initialSources} error={sourcesError} />

        {/* Submit + Terms */}
        <div className="space-y-3">
          <SubmitButton />
        </div>

        <p className="text-muted-foreground text-xs">
          By continuing you acknowledge that you understand and agree to our{" "}
          <Link
            className="underline transition-colors hover:text-foreground"
            href="/legal/terms"
          >
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link
            className="underline transition-colors hover:text-foreground"
            href="/legal/privacy"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
