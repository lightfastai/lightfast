CREATE TABLE `lightfast_org_source_control_bindings` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`clerk_org_id` varchar(191) NOT NULL,
	`active_clerk_org_id` varchar(191),
	`provider` varchar(50) NOT NULL,
	`provider_account_id` varchar(191),
	`provider_account_login` varchar(191),
	`provider_installation_id` varchar(191),
	`status` varchar(50) NOT NULL,
	`connected_by_user_id` varchar(191) NOT NULL,
	`connected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`revoked_at` timestamp,
	`metadata` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_org_source_control_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_source_control_bindings_active_per_org_uq` UNIQUE(`active_clerk_org_id`),
	CONSTRAINT `org_source_control_bindings_installation_uq` UNIQUE(`provider_installation_id`)
);
--> statement-breakpoint
CREATE INDEX `org_source_control_bindings_org_status_idx` ON `lightfast_org_source_control_bindings` (`clerk_org_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_source_control_bindings_provider_account_idx` ON `lightfast_org_source_control_bindings` (`provider`,`provider_account_id`);