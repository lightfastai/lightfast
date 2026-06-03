ALTER TABLE `lightfast_automation_runs` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_automations` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_people` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_signals` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_source_control_repositories` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_source_control_webhook_deliveries` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);