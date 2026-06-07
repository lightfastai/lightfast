CREATE TABLE `lightfast_org_source_control_pr_webhook_deliveries` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`delivery_id` varchar(128) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`org_source_control_binding_id` bigint unsigned NOT NULL,
	`source_control_repository_id` bigint unsigned NOT NULL,
	`provider_installation_id` varchar(128) NOT NULL,
	`provider_repository_id` varchar(128) NOT NULL,
	`event` varchar(64) NOT NULL,
	`action` varchar(64) NOT NULL,
	`provider_pull_request_id` varchar(128),
	`pull_request_number` bigint unsigned NOT NULL,
	`raw_payload` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_source_control_pr_webhook_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_source_control_pr_webhook_deliveries_delivery_uq` UNIQUE(`delivery_id`)
);
--> statement-breakpoint
ALTER TABLE `lightfast_org_source_control_repositories` ADD `watched_webhook_events` json;--> statement-breakpoint
CREATE INDEX `org_source_control_pr_webhook_deliveries_org_created_idx` ON `lightfast_org_source_control_pr_webhook_deliveries` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_source_control_pr_webhook_deliveries_repo_pr_idx` ON `lightfast_org_source_control_pr_webhook_deliveries` (`source_control_repository_id`,`pull_request_number`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_source_control_pr_webhook_deliveries_provider_repo_idx` ON `lightfast_org_source_control_pr_webhook_deliveries` (`provider_installation_id`,`provider_repository_id`,`created_at`,`id`);