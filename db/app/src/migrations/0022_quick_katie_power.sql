CREATE TABLE `lightfast_org_decision_views` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`config` json NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_decision_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_decision_views_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `org_decision_views_org_user_created_idx` ON `lightfast_org_decision_views` (`clerk_org_id`,`created_by_user_id`,`created_at`,`id`);