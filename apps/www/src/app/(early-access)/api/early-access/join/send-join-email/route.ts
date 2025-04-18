import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  EmailValidationError,
  validateEmail,
} from "~/components/early-access/early-access-form.validation";
import { EmailError, sendResendEmailSafe, UnknownError } from "~/lib/email";
import { InvalidJsonError, safeJsonParse } from "~/lib/next-request-parse";
import EarlyAccessEntryEmail from "~/templates/early-access-entry-email";

interface SendJoinEmailRequest {
  email: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const res = await safeJsonParse<SendJoinEmailRequest>(request);

  if (res.isErr()) {
    if (res.error instanceof InvalidJsonError) {
      return new NextResponse(res.error.message, { status: 400 });
    }

    console.error("Unknown error", res.error);
    return new NextResponse("Unknown error", { status: 400 });
  }

  const { email } = res.value;

  const res1 = validateEmail({ email });
  if (res1.isErr()) {
    if (res1.error instanceof EmailValidationError) {
      return new NextResponse(res1.error.message, { status: 400 });
    }

    console.error("Unknown error", res1.error);
    return new NextResponse("Unknown error", { status: 400 });
  }

  const res2 = await sendResendEmailSafe({
    react: EarlyAccessEntryEmail({ email }),
    to: email,
    subject: "Welcome to Lightfast.ai Early Access",
  })();

  if (res2.isErr()) {
    if (res2.error instanceof EmailError) {
      return new NextResponse(res2.error.message, { status: 500 });
    }

    if (res2.error instanceof UnknownError) {
      return new NextResponse(res2.error.message, { status: 500 });
    }

    console.error("Unknown error", res2.error);
    return new NextResponse("Unknown error", { status: 500 });
  }

  return NextResponse.json({ message: "Email sent" }, { status: 200 });
}
