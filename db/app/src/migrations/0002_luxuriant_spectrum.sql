CREATE TABLE `lightfast_opportunities` (
	`id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`created_by_api_key_id` varchar(128) NOT NULL,
	`input` text NOT NULL,
	`status` varchar(64) NOT NULL,
	`classification` json,
	`error_code` varchar(64),
	`error_message` text,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `opportunities_org_created_idx` ON `lightfast_opportunities` (`clerk_org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `opportunities_org_status_idx` ON `lightfast_opportunities` (`clerk_org_id`,`status`);