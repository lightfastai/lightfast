import { redirect } from "next/navigation";

export default function ApiPage() {
	// Redirect to the API reference overview
	redirect("/docs/api-reference/overview");
}