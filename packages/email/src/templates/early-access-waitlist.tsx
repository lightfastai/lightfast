import { Heading, Link, Section, Text } from "@react-email/components";
import { Button } from "@repo/ui-v2/components/email/button";
import { EmailFooter, LightfastMark } from "../components/email-brand";
import { EmailShell } from "../components/email-shell";

export interface EarlyAccessWaitlistEmailProps {
  readonly email: string;
  readonly manageUrl: string;
  readonly unsubscribeUrl?: string;
  readonly waitlistUrl: string;
}

export const EarlyAccessWaitlistEmail = ({
  manageUrl,
  unsubscribeUrl = manageUrl,
  waitlistUrl,
}: EarlyAccessWaitlistEmailProps) => (
  <EmailShell preview="Join the Lightfast early access waitlist.">
    <Section>
      <LightfastMark size={30} />
      <Heading className="m-0 mt-12 font-medium font-title text-[36px] text-foreground leading-[39.6px] tracking-[-0.03em]">
        Join the Lightfast early access waitlist.
      </Heading>
      <Text className="m-0 mt-4 text-lg text-muted-foreground leading-7">
        Early access is opening in small batches for teams building and
        operating agents.
      </Text>
    </Section>

    <Section className="mt-12 rounded-[24px] border border-border bg-card p-8">
      <Text className="m-0 text-base text-foreground leading-6">
        Lightfast is opening early access in small batches. Join the waitlist
        and we will use this address to reach out when a slot is ready.
      </Text>
      <Text className="m-0 mt-4 text-base text-foreground leading-6">
        If you are building with agents today, this is the list for private
        previews, product notes, and the earliest availability.
      </Text>
      <Button className="mt-6" href={waitlistUrl} size="lg">
        Join waitlist
      </Button>
      <Text className="m-0 mt-6 text-muted-foreground text-sm leading-5">
        If the button does not work, paste this link into your browser:
        <br />
        <Link
          className="font-mono text-primary text-sm leading-5 no-underline"
          href={waitlistUrl}
        >
          {waitlistUrl}
        </Link>
      </Text>
    </Section>

    <EmailFooter manageUrl={manageUrl} unsubscribeUrl={unsubscribeUrl} />
  </EmailShell>
);

EarlyAccessWaitlistEmail.PreviewProps = {
  email: "founder@example.com",
  manageUrl: "https://lightfast.ai/early-access/preferences",
  waitlistUrl: "https://lightfast.ai/early-access?token=preview",
} satisfies EarlyAccessWaitlistEmailProps;

export default EarlyAccessWaitlistEmail;
