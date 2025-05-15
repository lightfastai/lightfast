import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

import { siteConfig } from "@repo/lightfast-config";
import { Icons } from "@repo/ui/components/icons";

interface EarlyAccessEntryProps {
  email: string;
}

export function earlyAccessEntryEmailText({
  email,
}: EarlyAccessEntryProps): string {
  return `Welcome to Lightfast.ai Early Access!

${email}, you have joined the early access waitlist!

Thanks for joining our early access program. You're now part of an exclusive group helping shape the future of Lightfast.ai.

Keep an eye out for your early access invitation.

-------------------

Privacy Policy: ${siteConfig.links.privacy.href}
Terms & Conditions: ${siteConfig.links.terms.href}

-------------------

${new Date().getFullYear()} ${siteConfig.name} • ${siteConfig.location}`;
}

export const EarlyAccessEntryEmail = ({
  email = "info@lightfast.ai", // @note this is used for preview in react-email dev
}: EarlyAccessEntryProps) => {
  return (
    <Html>
      <Tailwind>
        <Head>
          <title>Welcome to Lightfast.ai Early Access</title>
          <Preview>You're in! Welcome to Lightfast.ai Early Access</Preview>
        </Head>
        <Body className="bg-white font-sans">
          <Container className="max-w-[600px] p-[32px]">
            <Icons.logo className="w-[20px]" />

            <Section className="mt-[24px]">
              <Heading className="m-0 mb-[24px] text-[18px] text-black">
                <span className="font-bold">{email}</span>
                <span className="font-normal text-black">
                  , you have joined the early access waitlist!
                </span>
              </Heading>

              <Container className="border-[1px] border-solid border-gray-300 p-[12px]">
                <Text className="mb-[24px] text-[12px] text-black">
                  Thanks for joining our early access program. You're now part
                  of an exclusive group helping shape the future of
                  Lightfast.ai.
                  <br />
                  <br /> Keep an eye out for your early access invitation.
                </Text>
              </Container>
            </Section>

            <Section className="mt-[12px] text-center">
              <Row>
                <Column>
                  <Link
                    href={siteConfig.links.privacy.href}
                    className="text-[0.6rem]"
                  >
                    Privacy Policy
                  </Link>
                  <Text className="mx-[4px] inline text-[0.6rem]">・</Text>
                  <Link
                    href={siteConfig.links.terms.href}
                    className="text-[0.6rem]"
                  >
                    Terms & Conditions
                  </Link>
                </Column>
              </Row>
            </Section>

            <Section className="mt-[16px] border-t border-gray-700 pt-[24px] text-center">
              <Text className="m-0 mb-[8px] text-[0.6rem] text-gray-500">
                {new Date().getFullYear()} {siteConfig.name} ・{" "}
                {siteConfig.location}
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EarlyAccessEntryEmail;
