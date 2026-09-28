CREATE TABLE `printers` (
	`owner` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `venues`(`owner`) ON UPDATE no action ON DELETE no action
);
