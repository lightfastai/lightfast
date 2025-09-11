CREATE TABLE `lightfast_chat_message_feedback` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`message_id` varchar(191) NOT NULL,
	`clerk_user_id` varchar(191) NOT NULL,
	`feedback_type` varchar(20) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `lightfast_chat_message_feedback_id` PRIMARY KEY(`id`)
);
