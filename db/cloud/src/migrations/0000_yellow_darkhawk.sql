CREATE TABLE `lightfast_cloud_api_key` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`key_hash` varchar(255) NOT NULL,
	`key_preview` varchar(20) NOT NULL,
	`name` varchar(100) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`last_used_at` datetime,
	`expires_at` datetime,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_cloud_api_key_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_cloud_deployment` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`name` varchar(255) NOT NULL,
	`bundle_url` varchar(500) NOT NULL,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_cloud_deployment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_cloud_api_key` (`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `key_hash_idx` ON `lightfast_cloud_api_key` (`key_hash`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_cloud_deployment` (`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `lightfast_cloud_deployment` (`created_at`);