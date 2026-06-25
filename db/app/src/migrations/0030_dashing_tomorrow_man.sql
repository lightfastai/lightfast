DROP TABLE IF EXISTS `lightfast_developer_sandbox_drop_guard`;--> statement-breakpoint
CREATE TABLE `lightfast_developer_sandbox_drop_guard` (`id` int NOT NULL, CONSTRAINT `lightfast_developer_sandbox_drop_guard_id` PRIMARY KEY(`id`));--> statement-breakpoint
INSERT INTO `lightfast_developer_sandbox_drop_guard` (`id`) VALUES (1);--> statement-breakpoint
INSERT INTO `lightfast_developer_sandbox_drop_guard` (`id`)
SELECT 1
FROM `lightfast_org_developer_sandbox_runs`
WHERE `status` IN ('starting', 'running', 'stopping')
LIMIT 1;--> statement-breakpoint
DROP TABLE `lightfast_developer_sandbox_drop_guard`;--> statement-breakpoint
DROP TABLE `lightfast_org_developer_connection_leases`;--> statement-breakpoint
DROP TABLE `lightfast_org_developer_connections`;--> statement-breakpoint
DROP TABLE `lightfast_org_developer_sandbox_commands`;--> statement-breakpoint
DROP TABLE `lightfast_org_developer_sandbox_runs`;
