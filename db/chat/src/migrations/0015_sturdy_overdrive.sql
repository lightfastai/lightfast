ALTER TABLE `lightfast_chat_usage` MODIFY COLUMN `period` varchar(10) NOT NULL;
--> statement-breakpoint
ALTER TABLE `lightfast_chat_quota_reservation` MODIFY COLUMN `period` varchar(10) NOT NULL;
