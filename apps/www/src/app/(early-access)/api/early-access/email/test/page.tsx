import { sendEmailResult } from "../../send-email-webhook/route";

export default async function GET() {
  return await sendEmailResult({ email: "testtest.com" });
}
