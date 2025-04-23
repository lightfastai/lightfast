/* eslint-disable @typescript-eslint/consistent-type-definitions */
// Initial context for repository identification
export interface EarlyAccessContactCreateData {
  email: string;
}

export interface EarlyAccessSendWelcomeEmailData {
  recipient: string;
  contactId: string;
}

export interface EarlyAccessContractCreateResult {
  success: boolean;
  timestamp: string;
  contactId: string;
  email: string;
}

export interface EarlyAccessSendWelcomeEmailResult {
  success: boolean;
  timestamp: string;
  contactId: string;
  recipient: string;
}

export type Events = {
  "early-access/email.welcome": {
    data: EarlyAccessSendWelcomeEmailData;
  };
  "early-access/contact.create": {
    data: EarlyAccessContactCreateData;
  };
};
