import { BillingSuccess } from "~/components/billing-success";

// Force dynamic rendering to support useSearchParams
export const dynamic = 'force-dynamic';

export default function BillingSuccessPage() {
	return <BillingSuccess />;
}