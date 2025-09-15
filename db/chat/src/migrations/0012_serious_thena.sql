CREATE TABLE `lightfast_chat_usage` (
	`id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`period` varchar(7) NOT NULL,
	`non_premium_messages` int NOT NULL DEFAULT 0,
	`premium_messages` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_period_idx` UNIQUE(`clerk_user_id`,`period`)
);
