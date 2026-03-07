"use client";

import { Accordion } from "@repo/ui/components/ui/accordion";
import { ORDERED_ADAPTERS } from "./adapters";
import { ProviderSourceItem } from "./provider-source-item";

export function SourcesSection() {
	return (
		<Accordion type="multiple" className="w-full rounded-lg border">
			{ORDERED_ADAPTERS.map((adapter) => (
				<ProviderSourceItem key={adapter.provider} adapter={adapter} />
			))}
		</Accordion>
	);
}
