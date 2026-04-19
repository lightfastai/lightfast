import { Resend } from "resend";

export const createEmailClient = (apiKey: string) => new Resend(apiKey);
