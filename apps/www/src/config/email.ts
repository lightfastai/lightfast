export interface EmailConfig {
  welcome: string;
  supportReployTo: string;
  legal: string;
}

export const emailConfig: EmailConfig = {
  welcome: "Lightfast.ai <welcome@mail.lightfast.ai>",
  supportReployTo: "Lightfast.ai <support@lightfast.ai>",
  legal: "legal@lightfast.ai",
};
