import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

import { Icons } from "~/app/icons";

interface EarlyAccessEntryProps {
  email: string;
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
          <Container className="max-w-[600px] rounded-[8px] p-[32px]">
            <Icons.logo className="size-5" />

            <Section className="mt-[24px]">
              <Heading className="m-0 mb-[24px] text-[18px] text-black">
                <span className="font-bold">{email}</span>
                <span className="font-normal text-black">
                  , you have joined the early access waitlist!
                </span>
              </Heading>

              <Container className="rounded-[2px] border-[1px] border-solid border-gray-300 p-[12px]">
                <Text className="mb-[24px] text-[12px] text-black">
                  Thanks for joining our early access program. You're now part
                  of an exclusive group helping shape the future of
                  Lightfast.ai.
                  <br />
                  <br /> Keep an eye out for your early access invitation.
                </Text>
              </Container>
            </Section>

            <Section className="mt-[12px] flex w-full items-center justify-center text-[0.6rem]">
              <Link href="/privacy" className="text-[0.6rem]">
                Privacy Policy
              </Link>
              ・
              <Link href="/terms" className="text-[0.6rem]">
                Terms & Conditions
              </Link>
            </Section>

            <Section className="mt-[16px] flex w-full items-center justify-center border-t border-gray-700 pt-[24px] text-gray-500">
              <Text className="m-0 mb-[8px] text-[0.6rem]">
                {new Date().getFullYear()} Lightfast.ai ・ 3141, Melbourne, VIC,
                Australia
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EarlyAccessEntryEmail;
