RENAME TABLE `lightfast_integration_calls` TO `lightfast_provider_routine_calls`;--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` RENAME COLUMN `routine_name` TO `routine_id`;--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` RENAME COLUMN `connector_connection_id` TO `provider_connection_id`;--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` DROP INDEX `integration_calls_public_id_uq`;--> statement-breakpoint
DROP INDEX `integration_calls_org_created_idx` ON `lightfast_provider_routine_calls`;--> statement-breakpoint
DROP INDEX `integration_calls_org_caller_created_idx` ON `lightfast_provider_routine_calls`;--> statement-breakpoint
DROP INDEX `integration_calls_connection_created_idx` ON `lightfast_provider_routine_calls`;--> statement-breakpoint
DROP INDEX `integration_calls_provider_routine_created_idx` ON `lightfast_provider_routine_calls`;--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` ADD `provider_attempted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` ADD `source_surface` varchar(32) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` ADD `source_ref` varchar(128);--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` ADD `source_client_id` varchar(128);--> statement-breakpoint
ALTER TABLE `lightfast_org_connector_connections` ADD `enabled_for_agents` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lightfast_provider_routine_calls` ADD CONSTRAINT `provider_routine_calls_public_id_uq` UNIQUE(`public_id`);--> statement-breakpoint
CREATE INDEX `provider_routine_calls_org_created_idx` ON `lightfast_provider_routine_calls` (`clerk_org_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `provider_routine_calls_org_caller_created_idx` ON `lightfast_provider_routine_calls` (`clerk_org_id`,`called_by_kind`,`called_by_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `provider_routine_calls_connection_created_idx` ON `lightfast_provider_routine_calls` (`provider_connection_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `provider_routine_calls_provider_routine_created_idx` ON `lightfast_provider_routine_calls` (`provider`,`routine_id`,`created_at`,`id`);
