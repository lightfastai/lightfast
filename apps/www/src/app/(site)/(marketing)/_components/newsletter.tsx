import { ArrowRight01Icon, Refresh03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { NewsletterForm, NewsletterSubmitButton } from "./newsletter-form";

export function Newsletter() {
  return (
    <div className="w-full">
      <NewsletterForm
        resetIcon={
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={Refresh03Icon}
            strokeWidth={2}
          />
        }
      >
        <label className="sr-only" htmlFor="footer-newsletter-email">
          Email address
        </label>
        <input
          aria-describedby="footer-newsletter-help"
          autoComplete="email"
          className="m-0 w-full cursor-pointer border border-border bg-muted p-3 pr-32 text-xs leading-tight outline-none transition-colors placeholder:text-foreground hover:border-muted-foreground/30 focus:border-ring disabled:cursor-not-allowed disabled:opacity-70"
          id="footer-newsletter-email"
          maxLength={256}
          name="email"
          placeholder="Email address"
          required
          type="email"
        />
        <NewsletterSubmitButton>
          <HugeiconsIcon
            aria-hidden="true"
            className="size-4"
            icon={ArrowRight01Icon}
            strokeWidth={2}
          />
        </NewsletterSubmitButton>
      </NewsletterForm>

      <p
        className="mt-2 text-muted-foreground text-xs leading-tight"
        id="footer-newsletter-help"
      >
        Unsubscribe anytime. See our{" "}
        <Link className="underline" href="/legal/privacy">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
