CREATE TABLE `audience_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`name` text NOT NULL,
	`fingerprint` text NOT NULL,
	`members` text NOT NULL,
	`stats` text NOT NULL,
	`mapping` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaign_events` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`email` text NOT NULL,
	`event` text NOT NULL,
	`link_id` text,
	`url` text,
	`reason` text,
	`timestamp` text NOT NULL,
	`is_test` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaign_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`source` text NOT NULL,
	`cutoff` text NOT NULL,
	`timezone` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaign_settings` (
	`client_id` text PRIMARY KEY NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`from_email` text DEFAULT '' NOT NULL,
	`reply_to` text DEFAULT '' NOT NULL,
	`mapping` text DEFAULT '{}' NOT NULL,
	`report_delay` integer DEFAULT 3 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`document_id` text,
	`name` text NOT NULL,
	`snapshot` text NOT NULL,
	`audience_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`planned_at` text,
	`sent_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`audience_id`) REFERENCES `audience_imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `click_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`email` text NOT NULL,
	`link_id` text NOT NULL,
	`url` text NOT NULL,
	`is_test` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`client_id` text NOT NULL,
	`email` text NOT NULL,
	`first_name` text DEFAULT '' NOT NULL,
	`last_name` text DEFAULT '' NOT NULL,
	`fields` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`client_id`, `email`),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `preference_tokens` (
	`hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
