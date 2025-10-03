CREATE TABLE `lightfast_deus_connected_repository` (
	`id` varchar(191) NOT NULL,
	`user_id` varchar(191) NOT NULL,
	`github_repo_id` varchar(191) NOT NULL,
	`installation_id` varchar(191),
	`access_token` text,
	`permissions` json,
	`is_active` boolean NOT NULL DEFAULT true,
	`connected_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	`last_synced_at` datetime,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `lightfast_deus_connected_repository_id` PRIMARY KEY(`id`),
	CONSTRAINT `lightfast_deus_connected_repository_github_repo_id_unique` UNIQUE(`github_repo_id`)
);
--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_deus_connected_repository` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_active_idx` ON `lightfast_deus_connected_repository` (`user_id`,`is_active`);