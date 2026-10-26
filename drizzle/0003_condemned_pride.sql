CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT 'user' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_project_title" UNIQUE("project_id","title")
);
--> statement-breakpoint
CREATE TABLE "page_issue_link" (
	"page_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	CONSTRAINT "page_issue_link_page_id_issue_id_pk" PRIMARY KEY("page_id","issue_id")
);
--> statement-breakpoint
CREATE TABLE "page_page_link" (
	"page_id" uuid NOT NULL,
	"target_page_id" uuid NOT NULL,
	CONSTRAINT "page_page_link_page_id_target_page_id_pk" PRIMARY KEY("page_id","target_page_id")
);
--> statement-breakpoint
CREATE TABLE "page_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"actor" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_issue_link" ADD CONSTRAINT "page_issue_link_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_issue_link" ADD CONSTRAINT "page_issue_link_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_page_link" ADD CONSTRAINT "page_page_link_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_page_link" ADD CONSTRAINT "page_page_link_target_page_id_page_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_version" ADD CONSTRAINT "page_version_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_issue_link_issue_idx" ON "page_issue_link" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "page_page_link_target_idx" ON "page_page_link" USING btree ("target_page_id");--> statement-breakpoint
CREATE INDEX "page_version_page_idx" ON "page_version" USING btree ("page_id");