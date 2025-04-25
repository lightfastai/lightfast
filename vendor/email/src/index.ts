import { Resend } from "resend";

export const createEmailClient = (apiKey: string) => {
  return new Resend(apiKey);
};
