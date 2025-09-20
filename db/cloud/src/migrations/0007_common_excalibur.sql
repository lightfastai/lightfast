CREATE TABLE `lightfast_cloud_agent_registry` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191),
	`name` varchar(255) NOT NULL,
	`bundle_url` varchar(500) NOT NULL,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`clerk_org_id` varchar(191) NOT NULL,
	`created_by_user_id` varchar(191) NOT NULL,
	CONSTRAINT `lightfast_cloud_agent_registry_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `org_id_idx` ON `lightfast_cloud_agent_registry` (`clerk_org_id`);--> statement-breakpoint
CREATE INDEX `org_name_idx` ON `lightfast_cloud_agent_registry` (`clerk_org_id`,`name`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `lightfast_cloud_agent_registry` (`created_at`);--> statement-breakpoint
CREATE INDEX `org_created_at_idx` ON `lightfast_cloud_agent_registry` (`clerk_org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_cloud_agent_registry` (`clerk_user_id`);