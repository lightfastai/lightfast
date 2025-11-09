import { redirect } from "next/navigation";

export default function ApiPage() {
	// Redirect to the new API reference overview
	redirect("/api/overview");
}