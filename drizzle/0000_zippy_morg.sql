CREATE TABLE `accesses` (
	`hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`employee` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `venues`(`owner`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`owner` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
