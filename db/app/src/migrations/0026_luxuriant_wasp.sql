CREATE TABLE `lightfast_org_signal_entity_links` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`signal_id` varchar(64) NOT NULL,
	`target_type` varchar(32) NOT NULL,
	`local_entity_key` varchar(64) NOT NULL,
	`label` varchar(160) NOT NULL,
	`mention_kind` varchar(32) NOT NULL,
	`anchor_text` varchar(240) NOT NULL,
	`anchor_occurrence` int unsigned NOT NULL,
	`extraction_method` varchar(32) NOT NULL,
	`confidence_basis_points` int unsigned NOT NULL,
	`rationale` text NOT NULL,
	`normalized_mention_value` varchar(512) NOT NULL,
	`resolved_person_id` varchar(64),
	`resolved_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_signal_entity_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_signal_entity_links_org_signal_local_entity_uq` UNIQUE(`clerk_org_id`,`signal_id`,`local_entity_key`)
);
--> statement-breakpoint
CREATE INDEX `org_signal_entity_links_org_signal_idx` ON `lightfast_org_signal_entity_links` (`clerk_org_id`,`signal_id`,`id`);--> statement-breakpoint
CREATE INDEX `org_signal_entity_links_org_resolved_person_idx` ON `lightfast_org_signal_entity_links` (`clerk_org_id`,`resolved_person_id`,`id`);--> statement-breakpoint
CREATE INDEX `org_signal_entity_links_org_mention_lookup_idx` ON `lightfast_org_signal_entity_links` (`clerk_org_id`,`target_type`,`mention_kind`,`normalized_mention_value`);