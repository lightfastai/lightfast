ALTER TABLE `lightfast_cloud_org_settings` DROP INDEX `lightfast_cloud_org_settings_slug_unique`;--> statement-breakpoint
DROP INDEX `slug_idx` ON `lightfast_cloud_org_settings`;--> statement-breakpoint
DROP INDEX `plan_type_idx` ON `lightfast_cloud_org_settings`;--> statement-breakpoint
ALTER TABLE `lightfast_cloud_org_settings` DROP COLUMN `display_name`;--> statement-breakpoint
ALTER TABLE `lightfast_cloud_org_settings` DROP COLUMN `slug`;--> statement-breakpoint
ALTER TABLE `lightfast_cloud_org_settings` DROP COLUMN `plan_type`;--> statement-breakpoint
ALTER TABLE `lightfast_cloud_org_settings` DROP COLUMN `settings`;