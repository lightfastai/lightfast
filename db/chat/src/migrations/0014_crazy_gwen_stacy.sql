CREATE TABLE `lightfast_chat_quota_reservation` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`message_id` varchar(191) NOT NULL,
	`model_id` varchar(191) NOT NULL,
	`message_type` varchar(10) NOT NULL,
	`period` varchar(7) NOT NULL,
	`status` varchar(10) NOT NULL DEFAULT 'reserved',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`completed_at` datetime,
	CONSTRAINT `lightfast_chat_quota_reservation_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_id_idx` UNIQUE(`message_id`)
);
--> statement-breakpoint
CREATE INDEX `user_period_idx` ON `lightfast_chat_quota_reservation` (`clerk_user_id`,`period`);--> statement-breakpoint
CREATE INDEX `status_created_idx` ON `lightfast_chat_quota_reservation` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `model_id_idx` ON `lightfast_chat_quota_reservation` (`model_id`);