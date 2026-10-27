CREATE TABLE `campaign_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`email` text NOT NULL,
	`source_revision` integer NOT NULL,
	`sent_by` text NOT NULL,
	`status` text NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`provider_message_id` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `campaign_test_recent` ON `campaign_tests` (`campaign_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `campaign_settings` ADD `sender_verified` integer DEFAULT false NOT NULL;