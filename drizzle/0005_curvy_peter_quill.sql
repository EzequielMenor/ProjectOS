CREATE TABLE "issue_property_value" (
	"issue_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "issue_property_value_issue_id_property_id_pk" PRIMARY KEY("issue_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "property_def" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_def_project_name" UNIQUE("project_id","name")
);
--> statement-breakpoint
ALTER TABLE "issue_property_value" ADD CONSTRAINT "issue_property_value_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_property_value" ADD CONSTRAINT "issue_property_value_property_id_property_def_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property_def"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_def" ADD CONSTRAINT "property_def_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_property_value_property_idx" ON "issue_property_value" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_def_project_idx" ON "property_def" USING btree ("project_id");