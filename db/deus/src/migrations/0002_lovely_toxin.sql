ALTER TABLE `lightfast_deus_organizations` DROP INDEX `lightfast_deus_organizations_github_installation_id_unique`;--> statement-breakpoint
ALTER TABLE `lightfast_deus_organizations` DROP INDEX `lightfast_deus_organizations_github_org_slug_unique`;--> statement-breakpoint
CREATE INDEX `org_slug_idx` ON `lightfast_deus_organizations` (`github_org_slug`);--> statement-breakpoint
CREATE INDEX `org_installation_idx` ON `lightfast_deus_organizations` (`github_installation_id`);