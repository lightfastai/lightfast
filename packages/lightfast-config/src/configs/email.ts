export interface EmailConfig {
  welcome: string;
  supportReployTo: string;
  auth: string;
  legal: string;
}

export const emailConfig: EmailConfig = {
  welcome: "Lightfast.ai <welcome@mail.lightfast.ai>",
  supportReployTo: "Lightfast.ai <support@mail.lightfast.ai>",
  auth: "Lightfast.ai <auth@mail.lightfast.ai>",
  legal: "legal@lightfast.ai",
};
