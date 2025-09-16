import { BillingCancelled } from "~/components/billing-cancelled";

// Force dynamic rendering to support useSearchParams
export const dynamic = 'force-dynamic';

export default function BillingCancelledPage() {
	return <BillingCancelled />;
}