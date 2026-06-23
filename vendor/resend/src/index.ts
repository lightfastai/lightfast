import { Resend } from "resend";

export const createResendClient = (apiKey: string) => new Resend(apiKey);

export type ResendClient = ReturnType<typeof createResendClient>;
