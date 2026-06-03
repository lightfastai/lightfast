ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `clerk_org_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `active_clerk_org_id` varchar(64);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `provider` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `provider_account_id` varchar(128);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `provider_account_login` varchar(128);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `provider_installation_id` varchar(128);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `status` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `connected_by_user_id` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `connected_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `revoked_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_bindings` MODIFY COLUMN `updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
