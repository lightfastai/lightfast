ALTER TABLE `lightfast_org_entity_accounts` ADD `canonical_key` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_entity_people` ADD `canonical_key` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_entity_person_account_affiliations` ADD `canonical_key` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_org_entity_accounts` ADD CONSTRAINT `org_entity_accounts_canonical_key_uq` UNIQUE(`clerk_org_id`,`canonical_key`);--> statement-breakpoint
ALTER TABLE `lightfast_org_entity_people` ADD CONSTRAINT `org_entity_people_canonical_key_uq` UNIQUE(`clerk_org_id`,`canonical_key`);--> statement-breakpoint
ALTER TABLE `lightfast_org_entity_person_account_affiliations` ADD CONSTRAINT `org_entity_affiliations_canonical_key_uq` UNIQUE(`clerk_org_id`,`canonical_key`);