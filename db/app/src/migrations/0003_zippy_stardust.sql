CREATE TABLE `lightfast_people` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`display_name` varchar(160),
	`identity_provider` varchar(32) NOT NULL,
	`identity_type` varchar(32) NOT NULL,
	`identity_value` text NOT NULL,
	`normalized_identity_value` varchar(512) NOT NULL,
	`identity_key` varchar(64) NOT NULL,
	`first_seen_signal_id` varchar(64),
	`last_seen_signal_id` varchar(64),
	`seen_count` int unsigned NOT NULL DEFAULT 1,
	`metadata` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_people_id` PRIMARY KEY(`id`),
	CONSTRAINT `people_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `people_org_identity_key_uq` UNIQUE(`clerk_org_id`,`identity_key`)
);
--> statement-breakpoint
CREATE INDEX `people_org_created_idx` ON `lightfast_people` (`clerk_org_id`,`created_at`,`id`);