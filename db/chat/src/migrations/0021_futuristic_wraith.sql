CREATE TABLE `lightfast_chat_attachment` (
	`id` varchar(191) NOT NULL,
	`message_id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`storage_provider` varchar(32) NOT NULL DEFAULT 'vercel-blob',
	`storage_path` varchar(512) NOT NULL,
	`url` varchar(1024),
	`download_url` varchar(1024),
	`filename` varchar(256),
	`content_type` varchar(128),
	`size` bigint NOT NULL,
	`metadata` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_attachment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `message_id_idx` ON `lightfast_chat_attachment` (`message_id`);--> statement-breakpoint
CREATE INDEX `session_id_idx` ON `lightfast_chat_attachment` (`session_id`);
