import {
  Heading,
  Link,
  Section,
  Text,
} from "@react-email/components";
import { Button } from "@repo/ui-v2/components/email/button";
import { EmailFooter, LightfastMark } from "../components/email-brand";
import { EmailShell } from "../components/email-shell";

export interface NewsletterConfirmationEmailProps {
  readonly confirmUrl: string;
  readonly email: string;
  readonly manageUrl: string;
  readonly unsubscribeUrl?: string;
}

export const NewsletterConfirmationEmail = ({
  confirmUrl,
  email,
  manageUrl,
  unsubscribeUrl = manageUrl,
}: NewsletterConfirmationEmailProps) => (
  <EmailShell preview="Confirm your Lightfast newsletter subscription.">
    <Section>
      <LightfastMark size={30} />
      <Heading className="m-0 mt-12 font-medium font-title text-[36px] text-foreground leading-[39.6px] tracking-[-0.03em]">
        Confirm your Lightfast newsletter subscription.
      </Heading>
      <Text className="m-0 mt-4 text-lg text-muted-foreground leading-7">
        Research notes, product updates, and the occasional field report from
        the agent infrastructure frontier.
      </Text>
    </Section>

    <Section className="mt-12 rounded-[24px] border border-border bg-card p-8">
      <Text className="m-0 text-base text-foreground leading-6">
        Please confirm that this address should receive Lightfast notes. We keep
        these short: useful product context, build notes, and research signals
        when something genuinely matters.
      </Text>
      <Text className="m-0 mt-4 text-base text-foreground leading-6">
        If you did not request this, you can ignore the email. Nothing changes
        unless you confirm.
      </Text>
      <Button className="mt-6" href={confirmUrl} size="lg">
        Confirm subscription
      </Button>
      <Text className="m-0 mt-6 text-muted-foreground text-sm leading-5">
        If the button does not work, paste this link into your browser:
        <br />
        <Link
          className="font-mono text-primary text-sm leading-5 no-underline"
          href={confirmUrl}
        >
          {confirmUrl}
        </Link>
      </Text>
    </Section>

    <EmailFooter manageUrl={manageUrl} unsubscribeUrl={unsubscribeUrl} />
  </EmailShell>
);

NewsletterConfirmationEmail.PreviewProps = {
  confirmUrl: "https://lightfast.ai/newsletter/confirm?token=preview",
  email: "founder@example.com",
  manageUrl: "https://lightfast.ai/newsletter/preferences",
} satisfies NewsletterConfirmationEmailProps;

export default NewsletterConfirmationEmail;
