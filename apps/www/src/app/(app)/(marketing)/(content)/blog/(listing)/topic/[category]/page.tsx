import { redirect } from "next/navigation";

// Blog topic pages redirect to the main blog listing.
// Category filtering is handled client-side by the CategoryNav component.
export default function CategoryPage() {
  redirect("/blog");
}
