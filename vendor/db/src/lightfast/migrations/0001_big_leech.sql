CREATE TABLE `lightfast_chat_stream` (
	`id` varchar(191) NOT NULL,
	`session_id` varchar(191) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lightfast_chat_stream_id` PRIMARY KEY(`id`)
);
