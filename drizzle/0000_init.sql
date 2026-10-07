CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`invoice_id` text,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_invoice_id_idx` ON `audit_log` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clients_email_uidx` ON `clients` (`email`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`paypal_invoice_id` text,
	`paypal_invoice_number` text,
	`client_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`status` text NOT NULL,
	`due_date` integer,
	`issued_at` integer,
	`paid_at` integer,
	`hosted_url` text,
	`line_items` text NOT NULL,
	`created_by` text NOT NULL,
	`note` text,
	`original_amount_cents` integer,
	`original_currency` text,
	`fx_rate` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_paypal_invoice_id_uidx` ON `invoices` (`paypal_invoice_id`);--> statement-breakpoint
CREATE INDEX `invoices_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoices_client_id_idx` ON `invoices` (`client_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`sent_at` integer NOT NULL,
	`subject` text NOT NULL,
	`note` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reminders_invoice_id_idx` ON `reminders` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`processed_at` integer NOT NULL
);
