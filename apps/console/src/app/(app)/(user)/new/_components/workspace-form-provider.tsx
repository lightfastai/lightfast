"use client";

import type { ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormCompat, Form } from "@repo/ui/components/ui/form";
import { workspaceFormSchema } from "@repo/console-validation/forms";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";

/**
 * WorkspaceFormProvider
 *
 * Wraps the workspace creation form with react-hook-form validation.
 * Source selection has been moved to SourceSelectionProvider in sources/new.
 */
export function WorkspaceFormProvider({
	children,
	initialOrgId,
	initialWorkspaceName,
}: {
	children: ReactNode;
	initialOrgId?: string;
	initialWorkspaceName?: string;
}) {
	const form = useFormCompat<WorkspaceFormValues>({
		resolver: zodResolver(workspaceFormSchema),
		defaultValues: {
			organizationId: initialOrgId ?? "",
			workspaceName: initialWorkspaceName ?? "",
		},
		mode: "onChange",
	});

	return <Form {...form}>{children}</Form>;
}
