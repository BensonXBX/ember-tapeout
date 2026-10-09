CREATE TABLE `arena_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`since` integer NOT NULL,
	`count` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `arena_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`quick` integer DEFAULT 0 NOT NULL,
	`updated` integer NOT NULL,
	`expires` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `arena_match_idx` ON `arena_rooms` (`status`,`quick`,`updated`);--> statement-breakpoint
CREATE INDEX `arena_expiry_idx` ON `arena_rooms` (`expires`);