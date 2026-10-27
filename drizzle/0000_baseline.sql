CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_versions" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"client_id" text,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "component_versions_id_version_pk" PRIMARY KEY("id","version")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_versions" (
	"id" text NOT NULL,
	"version" integer NOT NULL,
	"client_id" text,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"metadata" text NOT NULL,
	"preview_brand" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "template_versions_id_version_pk" PRIMARY KEY("id","version")
);
--> statement-breakpoint
CREATE TABLE "audience_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"fingerprint" text NOT NULL,
	"members" text NOT NULL,
	"stats" text NOT NULL,
	"mapping" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_events" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"email" text NOT NULL,
	"event" text NOT NULL,
	"link_id" text,
	"url" text,
	"reason" text,
	"timestamp" text NOT NULL,
	"is_test" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"cutoff" text NOT NULL,
	"timezone" text NOT NULL,
	"data" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_settings" (
	"client_id" text PRIMARY KEY NOT NULL,
	"sender_name" text DEFAULT '' NOT NULL,
	"from_email" text DEFAULT '' NOT NULL,
	"reply_to" text DEFAULT '' NOT NULL,
	"mapping" text DEFAULT '{}' NOT NULL,
	"report_delay" integer DEFAULT 3 NOT NULL,
	"sender_verified" boolean DEFAULT false NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_tests" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"email" text NOT NULL,
	"source_revision" integer NOT NULL,
	"sent_by" text NOT NULL,
	"status" text NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"provider_message_id" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"document_id" text,
	"name" text NOT NULL,
	"snapshot" text NOT NULL,
	"audience_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"planned_at" text,
	"sent_at" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "click_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"email" text NOT NULL,
	"link_id" text NOT NULL,
	"url" text NOT NULL,
	"is_test" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"client_id" text NOT NULL,
	"email" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"fields" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "contacts_client_id_email_pk" PRIMARY KEY("client_id","email")
);
--> statement-breakpoint
CREATE TABLE "preference_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" text NOT NULL,
	"last_seen_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	"last_login_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_versions" ADD CONSTRAINT "component_versions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_imports" ADD CONSTRAINT "audience_imports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_reports" ADD CONSTRAINT "campaign_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_reports" ADD CONSTRAINT "campaign_reports_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_settings" ADD CONSTRAINT "campaign_settings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tests" ADD CONSTRAINT "campaign_tests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tests" ADD CONSTRAINT "campaign_tests_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_audience_id_audience_imports_id_fk" FOREIGN KEY ("audience_id") REFERENCES "public"."audience_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_tokens" ADD CONSTRAINT "click_tokens_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_tokens" ADD CONSTRAINT "click_tokens_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_tokens" ADD CONSTRAINT "preference_tokens_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "audience_import_identity" ON "audience_imports" USING btree ("client_id","fingerprint","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_report_identity" ON "campaign_reports" USING btree ("campaign_id","fingerprint");--> statement-breakpoint
CREATE INDEX "campaign_test_recent" ON "campaign_tests" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");