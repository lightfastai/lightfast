export {
  useAuth,
  useOrganization,
  useOrganizationList,
} from "@clerk/tanstack-react-start";
export { isClerkAPIResponseError } from "@clerk/tanstack-react-start/errors";
export {
  CheckoutProvider,
  PaymentElement,
  PaymentElementProvider,
  useCheckout,
  usePaymentElement,
  usePaymentMethods,
  useStatements,
} from "@clerk/tanstack-react-start/experimental";
export type {
  BillingMoneyAmount,
  BillingPaymentMethodResource,
  BillingStatementResource,
  CheckoutErrors,
} from "@clerk/tanstack-react-start/types";

export class ClerkAPIResponseError extends Error {
  errors: Array<{ code: string }> = [];
  status = 500;
}

export function isUserLockedError() {
  return false;
}
