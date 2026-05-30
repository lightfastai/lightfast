CREATE TABLE `lightfast_user_source_control_accounts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`clerk_user_id` varchar(64) NOT NULL,
	`active_clerk_user_id` varchar(64),
	`active_provider_user_key` varchar(192),
	`provider` varchar(32) NOT NULL,
	`provider_user_id` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`connected_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`revoked_at` timestamp(3),
	`encrypted_access_token` text NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`access_token_expires_at` timestamp(3) NOT NULL,
	`refresh_token_expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_user_source_control_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_source_control_accounts_active_user_uq` UNIQUE(`active_clerk_user_id`),
	CONSTRAINT `user_source_control_accounts_active_provider_user_uq` UNIQUE(`active_provider_user_key`)
);
--> statement-breakpoint
CREATE INDEX `user_source_control_accounts_user_status_idx` ON `lightfast_user_source_control_accounts` (`clerk_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `user_source_control_accounts_provider_user_idx` ON `lightfast_user_source_control_accounts` (`provider`,`provider_user_id`);