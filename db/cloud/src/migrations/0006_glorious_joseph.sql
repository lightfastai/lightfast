CREATE TABLE `lightfast_cloud_agent` (
	`id` varchar(191) NOT NULL,
	`clerk_org_id` varchar(191) NOT NULL,
	`name` varchar(100) NOT NULL,
	`version` varchar(50) NOT NULL,
	`bundle_url` varchar(500) NOT NULL,
	`author_user_id` varchar(191) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_cloud_agent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `org_id_idx` ON `lightfast_cloud_agent` (`clerk_org_id`);--> statement-breakpoint
CREATE INDEX `org_name_idx` ON `lightfast_cloud_agent` (`clerk_org_id`,`name`);