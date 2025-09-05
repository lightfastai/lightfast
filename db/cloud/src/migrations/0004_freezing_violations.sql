CREATE TABLE `lightfast_cloud_org_settings` (
	`id` varchar(191) NOT NULL,
	`clerk_org_id` varchar(191) NOT NULL,
	`display_name` varchar(100),
	`slug` varchar(50),
	`plan_type` enum('free','pro','enterprise') NOT NULL DEFAULT 'free',
	`api_key_limit` int NOT NULL DEFAULT 10,
	`deployment_limit` int NOT NULL DEFAULT 100,
	`monthly_execution_limit` bigint NOT NULL DEFAULT 1000000,
	`settings` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_cloud_org_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `lightfast_cloud_org_settings_clerk_org_id_unique` UNIQUE(`clerk_org_id`),
	CONSTRAINT `lightfast_cloud_org_settings_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `lightfast_cloud_api_key` MODIFY COLUMN `clerk_user_id` varchar(191);--> statement-breakpoint
ALTER TABLE `lightfast_cloud_deployment` MODIFY COLUMN `clerk_user_id` varchar(191);--> statement-breakpoint
ALTER TABLE `lightfast_cloud_api_key` ADD `clerk_org_id` varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_cloud_api_key` ADD `created_by_user_id` varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_cloud_deployment` ADD `clerk_org_id` varchar(191) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_cloud_deployment` ADD `created_by_user_id` varchar(191) NOT NULL;--> statement-breakpoint
CREATE INDEX `org_id_idx` ON `lightfast_cloud_org_settings` (`clerk_org_id`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `lightfast_cloud_org_settings` (`slug`);--> statement-breakpoint
CREATE INDEX `plan_type_idx` ON `lightfast_cloud_org_settings` (`plan_type`);--> statement-breakpoint
CREATE INDEX `org_id_idx` ON `lightfast_cloud_api_key` (`clerk_org_id`);--> statement-breakpoint
CREATE INDEX `org_created_by_idx` ON `lightfast_cloud_api_key` (`clerk_org_id`,`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `org_id_idx` ON `lightfast_cloud_deployment` (`clerk_org_id`);--> statement-breakpoint
CREATE INDEX `org_created_at_idx` ON `lightfast_cloud_deployment` (`clerk_org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `org_name_idx` ON `lightfast_cloud_deployment` (`clerk_org_id`,`name`);