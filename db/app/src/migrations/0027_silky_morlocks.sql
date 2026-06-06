CREATE TABLE `lightfast_org_entity_accounts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`canonical_key` varchar(512) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`display_name` varchar(256) NOT NULL,
	`normalized_name` varchar(256) NOT NULL,
	`account_type` varchar(64) NOT NULL DEFAULT 'unknown',
	`primary_domain` varchar(255),
	`status` varchar(64) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`confirmed_by_type` varchar(64),
	`confirmed_by_id` varchar(128),
	`confirmation_policy` varchar(128),
	`confirmed_at` datetime(3),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_accounts_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_entity_accounts_canonical_key_uq` UNIQUE(`clerk_org_id`,`canonical_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_evidence_items` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`subject_type` varchar(64) NOT NULL,
	`subject_id` bigint unsigned,
	`claim_type` varchar(64) NOT NULL,
	`claim_value` text NOT NULL,
	`source_observation_id` bigint unsigned,
	`confidence` decimal(5,4) NOT NULL,
	`status` varchar(64) NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	`superseded_by_evidence_id` bigint unsigned,
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_evidence_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_evidence_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_links` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`source_identity_id` bigint unsigned NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` bigint unsigned NOT NULL,
	`status` varchar(64) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`confirmed_by_type` varchar(64),
	`confirmed_by_id` varchar(128),
	`confirmation_policy` varchar(128),
	`confirmed_at` datetime(3),
	`created_by_type` varchar(64) NOT NULL,
	`resolver_version` varchar(128),
	`superseded_by_link_id` bigint unsigned,
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_links_public_id_uq` UNIQUE(`public_id`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_observations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`source_identity_id` bigint unsigned NOT NULL,
	`provider` varchar(64) NOT NULL,
	`observed_at` datetime(3) NOT NULL,
	`content_hash` varchar(128) NOT NULL,
	`normalized_snapshot` json NOT NULL,
	`raw_snapshot` json,
	`raw_expires_at` datetime(3),
	`status` varchar(64) NOT NULL DEFAULT 'active',
	`superseded_by_observation_id` bigint unsigned,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_observations_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_observations_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_entity_observations_identity_hash_uq` UNIQUE(`source_identity_id`,`content_hash`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_people` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`canonical_key` varchar(512) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`display_name` varchar(256) NOT NULL,
	`status` varchar(64) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`primary_source_identity_id` bigint unsigned,
	`confirmed_by_type` varchar(64),
	`confirmed_by_id` varchar(128),
	`confirmation_policy` varchar(128),
	`confirmed_at` datetime(3),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_people_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_people_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_entity_people_canonical_key_uq` UNIQUE(`clerk_org_id`,`canonical_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_person_account_affiliations` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`canonical_key` varchar(512) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`person_id` bigint unsigned NOT NULL,
	`account_id` bigint unsigned NOT NULL,
	`relationship` varchar(64) NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	`title` varchar(256),
	`status` varchar(64) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`confirmed_by_type` varchar(64),
	`confirmed_by_id` varchar(128),
	`confirmation_policy` varchar(128),
	`confirmed_at` datetime(3),
	`started_at` datetime(3),
	`ended_at` datetime(3),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_person_account_affiliations_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_affiliations_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_entity_affiliations_canonical_key_uq` UNIQUE(`clerk_org_id`,`canonical_key`),
	CONSTRAINT `org_entity_affiliations_person_account_rel_uq` UNIQUE(`clerk_org_id`,`person_id`,`account_id`,`relationship`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_resolution_candidate_groups` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`candidate_type` varchar(64) NOT NULL,
	`candidate_key` varchar(512) NOT NULL,
	`current_candidate_version_id` bigint unsigned,
	`status` varchar(64) NOT NULL,
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_resolution_candidate_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_cand_groups_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_entity_cand_groups_key_uq` UNIQUE(`clerk_org_id`,`candidate_type`,`candidate_key`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_resolution_candidate_versions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`candidate_group_id` bigint unsigned NOT NULL,
	`resolver_version` varchar(128) NOT NULL,
	`input_hash` varchar(128) NOT NULL,
	`output_hash` varchar(128) NOT NULL,
	`status` varchar(64) NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`output_json` json NOT NULL,
	`superseded_at` datetime(3),
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_resolution_candidate_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_cand_versions_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_entity_cand_versions_group_output_uq` UNIQUE(`candidate_group_id`,`output_hash`)
);
--> statement-breakpoint
CREATE TABLE `lightfast_org_entity_source_identities` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`public_id` varchar(80) NOT NULL,
	`clerk_org_id` varchar(64) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`identity_type` varchar(64) NOT NULL,
	`identity_value` text NOT NULL,
	`normalized_value` varchar(512) NOT NULL,
	`identity_key` varchar(512) NOT NULL,
	`status` varchar(64) NOT NULL,
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `lightfast_org_entity_source_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_entity_sources_public_id_uq` UNIQUE(`public_id`),
	CONSTRAINT `org_entity_sources_identity_key_uq` UNIQUE(`clerk_org_id`,`identity_key`)
);
--> statement-breakpoint
CREATE INDEX `org_entity_accounts_org_domain_idx` ON `lightfast_org_entity_accounts` (`clerk_org_id`,`primary_domain`);--> statement-breakpoint
CREATE INDEX `org_entity_accounts_org_name_idx` ON `lightfast_org_entity_accounts` (`clerk_org_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `org_entity_accounts_org_status_idx` ON `lightfast_org_entity_accounts` (`clerk_org_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_evidence_subject_idx` ON `lightfast_org_entity_evidence_items` (`clerk_org_id`,`subject_type`,`subject_id`,`claim_type`);--> statement-breakpoint
CREATE INDEX `org_entity_evidence_observation_idx` ON `lightfast_org_entity_evidence_items` (`source_observation_id`,`observed_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_links_identity_entity_status_idx` ON `lightfast_org_entity_links` (`clerk_org_id`,`source_identity_id`,`entity_type`,`status`);--> statement-breakpoint
CREATE INDEX `org_entity_links_entity_status_idx` ON `lightfast_org_entity_links` (`clerk_org_id`,`entity_type`,`entity_id`,`status`);--> statement-breakpoint
CREATE INDEX `org_entity_observations_identity_observed_idx` ON `lightfast_org_entity_observations` (`source_identity_id`,`observed_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_observations_provider_observed_idx` ON `lightfast_org_entity_observations` (`clerk_org_id`,`provider`,`observed_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_people_org_status_idx` ON `lightfast_org_entity_people` (`clerk_org_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_people_primary_source_idx` ON `lightfast_org_entity_people` (`clerk_org_id`,`primary_source_identity_id`);--> statement-breakpoint
CREATE INDEX `org_entity_affiliations_person_status_idx` ON `lightfast_org_entity_person_account_affiliations` (`person_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_affiliations_account_status_idx` ON `lightfast_org_entity_person_account_affiliations` (`account_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_cand_groups_status_idx` ON `lightfast_org_entity_resolution_candidate_groups` (`clerk_org_id`,`status`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_cand_versions_group_created_idx` ON `lightfast_org_entity_resolution_candidate_versions` (`candidate_group_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `org_entity_sources_provider_idx` ON `lightfast_org_entity_source_identities` (`clerk_org_id`,`provider`,`identity_type`);