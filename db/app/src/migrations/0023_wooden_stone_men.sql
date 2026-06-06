ALTER TABLE `lightfast_org_people` ADD `person_source` varchar(32) DEFAULT 'signal' NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_people` ADD `member_status` varchar(32);--> statement-breakpoint
ALTER TABLE `lightfast_org_people` ADD `clerk_user_id` varchar(64);--> statement-breakpoint
ALTER TABLE `lightfast_org_people` ADD `member_role` varchar(32);--> statement-breakpoint
ALTER TABLE `lightfast_org_people` ADD `member_synced_at` datetime(3);--> statement-breakpoint
CREATE INDEX `org_people_org_person_source_idx` ON `lightfast_org_people` (`clerk_org_id`,`person_source`,`id`);--> statement-breakpoint
CREATE INDEX `org_people_org_member_status_idx` ON `lightfast_org_people` (`clerk_org_id`,`member_status`,`id`);