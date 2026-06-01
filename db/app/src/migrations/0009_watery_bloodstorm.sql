CREATE TABLE `lightfast_people_views` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(64) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`created_by_user_id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`config` json NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_people_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `people_views_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE INDEX `people_views_org_user_created_idx` ON `lightfast_people_views` (`clerk_org_id`,`created_by_user_id`,`created_at`,`id`);