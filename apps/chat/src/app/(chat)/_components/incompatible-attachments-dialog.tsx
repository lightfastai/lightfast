"use client";

import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@repo/ui/components/ui/dialog";
import { Button } from "@repo/ui/components/ui/button";
import { AlertTriangle, FileX, ArrowRight } from "lucide-react";
import type { ModelId } from "~/ai/providers";

interface IncompatibleFile {
	filename: string;
	reason: "no-vision" | "no-pdf";
}

interface IncompatibleAttachmentsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentModelName: string;
	incompatibleFiles: IncompatibleFile[];
	suggestedModelId?: ModelId;
	suggestedModelName?: string;
	onRemoveIncompatible: () => void;
	onSwitchModel: (modelId: ModelId) => void;
}

export function IncompatibleAttachmentsDialog({
	open,
	onOpenChange,
	currentModelName,
	incompatibleFiles,
	suggestedModelId,
	suggestedModelName,
	onRemoveIncompatible,
	onSwitchModel,
}: IncompatibleAttachmentsDialogProps) {
	const hasNoVision = incompatibleFiles.some((f) => f.reason === "no-vision");
	const hasNoPdf = incompatibleFiles.some((f) => f.reason === "no-pdf");

	const getReasonText = () => {
		if (hasNoVision && hasNoPdf) {
			return "doesn't support image or PDF attachments";
		}
		if (hasNoPdf) {
			return "doesn't support PDF attachments";
		}
		return "doesn't support image attachments";
	};

	const handleRemove = () => {
		onRemoveIncompatible();
		onOpenChange(false);
	};

	const handleSwitch = () => {
		if (suggestedModelId) {
			onSwitchModel(suggestedModelId);
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<div className="flex items-start gap-4">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10">
						<AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
					</div>
					<div className="flex-1 space-y-1">
						<DialogTitle className="text-lg font-semibold">
							Incompatible Attachments
						</DialogTitle>
						<DialogDescription className="text-sm text-muted-foreground">
							{currentModelName} {getReasonText()}. Choose how to proceed:
						</DialogDescription>
					</div>
				</div>

				{/* List of incompatible files */}
				<div className="rounded-lg border bg-muted/30 p-3">
					<div className="space-y-2">
						{incompatibleFiles.map((file, idx) => (
							<div
								key={idx}
								className="flex items-center gap-2 text-sm"
							>
								<FileX className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
								<span className="truncate font-medium">{file.filename}</span>
								<span className="shrink-0 text-xs text-muted-foreground">
									({file.reason === "no-pdf" ? "PDF not supported" : "Attachments not supported"})
								</span>
							</div>
						))}
					</div>
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-col">
					{/* Primary action: Remove incompatible */}
					<Button
						onClick={handleRemove}
						variant="default"
						className="w-full"
					>
						<FileX className="mr-2 h-4 w-4" />
						Remove {incompatibleFiles.length === 1 ? "File" : "Files"} and Send
					</Button>

					{/* Secondary action: Switch model */}
					{suggestedModelId && suggestedModelName && (
						<Button
							onClick={handleSwitch}
							variant="outline"
							className="w-full"
						>
							<ArrowRight className="mr-2 h-4 w-4" />
							Switch to {suggestedModelName}
						</Button>
					)}

					{/* Tertiary action: Cancel */}
					<Button
						onClick={() => onOpenChange(false)}
						variant="ghost"
						className="w-full"
					>
						Cancel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
