ALTER TABLE `lightfast_cloud_api_key` ADD `key_lookup` varchar(64) NOT NULL;--> statement-breakpoint
CREATE INDEX `key_lookup_idx` ON `lightfast_cloud_api_key` (`key_lookup`);