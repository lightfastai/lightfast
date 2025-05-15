import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";

interface CodeEmailProps {
  email: string;
  code: string;
}

export function codeEmailText({ code }: { code: string }): string {
  return `Your Lightfast.ai sign-in code: ${code}

Enter this code to continue signing in.

If you did not request this, you can ignore this email.`;
}

export const CodeEmail = ({ email, code }: CodeEmailProps) => (
  <Html>
    <Tailwind>
      <Head>
        <title>Your Lightfast.ai sign-in code</title>
        <Preview>Your sign-in code: {code}</Preview>
      </Head>
      <Body className="bg-white font-sans">
        <Container className="max-w-[600px] p-[32px]">
          <Heading className="mb-[24px] text-[18px] text-black">
            Your Lightfast.ai sign-in code
          </Heading>
          <Text className="mb-[16px] font-mono text-[16px] text-black">
            {code}
          </Text>
          <Text className="mb-[24px] text-[12px] text-black">
            Enter this code to continue signing in as <b>{email}</b>.
            <br />
            <br />
            If you did not request this, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default CodeEmail;
