CREATE TABLE `lightfast_signal_views` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`config` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_signal_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_views_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
ALTER TABLE `lightfast_signals` MODIFY COLUMN `created_by_api_key_id` varchar(128);--> statement-breakpoint
ALTER TABLE `lightfast_signals` ADD `visibility_scope` varchar(32) DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX `signal_views_org_user_created_idx` ON `lightfast_signal_views` (`clerk_org_id`,`created_by_user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `signals_org_visibility_created_idx` ON `lightfast_signals` (`clerk_org_id`,`visibility_scope`,`created_at`,`id`);