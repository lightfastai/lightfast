CREATE TABLE `lightfast_cloud_api_key_audit_log` (
	`id` varchar(191) NOT NULL,
	`api_key_id` varchar(191),
	`clerk_user_id` varchar(191),
	`action` varchar(50) NOT NULL,
	`result` varchar(20) NOT NULL,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`metadata` varchar(1000),
	`request_id` varchar(191),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_cloud_api_key_audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `api_key_id_idx` ON `lightfast_cloud_api_key_audit_log` (`api_key_id`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `lightfast_cloud_api_key_audit_log` (`clerk_user_id`);--> statement-breakpoint
CREATE INDEX `action_idx` ON `lightfast_cloud_api_key_audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `lightfast_cloud_api_key_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `ip_address_idx` ON `lightfast_cloud_api_key_audit_log` (`ip_address`);