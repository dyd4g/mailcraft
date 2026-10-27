CREATE TABLE `template_versions` (
	`id` text NOT NULL,
	`version` integer NOT NULL,
	`client_id` text,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text NOT NULL,
	`preview_brand` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`id`, `version`),
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
