import { Input } from "@repo/ui/components/ui/input";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { joinEarlyAccessAction } from "../_actions/early-access";
import { CompanySizeIsland } from "./company-size-island";
import { SourcesIsland } from "./sources-island";
import { SubmitButton } from "./submit-button";

interface EarlyAccessFormServerProps {
  emailError?: string | null;
  initialCompanySize: string;
  initialEmail: string;
  initialSources: string[];
}

export function EarlyAccessFormServer({
  initialEmail,
  initialCompanySize,
  initialSources,
  emailError,
}: EarlyAccessFormServerProps) {
  return (
    <div className="w-full">
      <form action={joinEarlyAccessAction} className="flex flex-col space-y-4">
        {/* Email — pure server-rendered input */}
        <div className="flex flex-col gap-2">
          <label
            className="font-medium text-muted-foreground text-sm"
            htmlFor="email"
          >
            Email address
          </label>
          <Input
            aria-invalid={!!emailError}
            defaultValue={initialEmail}
            id="email"
            name="email"
            placeholder="name@company.com"
            type="email"
          />
        </div>

        {/* Company Size — client island (shadcn Select needs JS) */}
        <div className="flex flex-col gap-2">
          <label
            className="font-medium text-muted-foreground text-sm"
            htmlFor="companySize"
          >
            Company size
          </label>
          <CompanySizeIsland defaultValue={initialCompanySize} />
        </div>

        {/* Sources — client island (Popover+Command combobox) */}
        <div className="flex flex-col gap-2">
          <label
            className="font-medium text-muted-foreground text-sm"
            htmlFor="sources"
          >
            Tools your team uses
          </label>
          <SourcesIsland defaultSources={initialSources} />
        </div>

        {/* Submit + Terms */}
        <div className="space-y-3">
          <SubmitButton />
        </div>

        <p className="text-center text-muted-foreground text-sm">
          By continuing you acknowledge that you understand and agree to our{" "}
          <MicrofrontendLink
            className="text-foreground underline hover:text-foreground/80"
            href="/legal/terms"
            rel="noopener noreferrer"
            target="_blank"
          >
            Terms of Service
          </MicrofrontendLink>{" "}
          and{" "}
          <MicrofrontendLink
            className="text-foreground underline hover:text-foreground/80"
            href="/legal/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            Privacy Policy
          </MicrofrontendLink>
          .
        </p>
      </form>
    </div>
  );
}
