// Auto-generated bundled migrations for serverless / Vercel execution without runtime fs access.
export const bundledMigrationQueries = [
  {
    "sql": [
      "CREATE TABLE \"activity\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"issue_id\" uuid,\n\t\"actor\" text DEFAULT 'user' NOT NULL,\n\t\"action\" text NOT NULL,\n\t\"data\" jsonb DEFAULT '{}'::jsonb NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"comment\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"issue_id\" uuid NOT NULL,\n\t\"actor\" text DEFAULT 'user' NOT NULL,\n\t\"body\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"issue\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"seq\" integer NOT NULL,\n\t\"type\" text DEFAULT 'issue' NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"description\" text DEFAULT '' NOT NULL,\n\t\"state_id\" uuid NOT NULL,\n\t\"priority\" text DEFAULT 'none' NOT NULL,\n\t\"parent_id\" uuid,\n\t\"assignee_id\" uuid,\n\t\"estimate\" integer,\n\t\"start_date\" date,\n\t\"due_date\" date,\n\t\"sort_order\" double precision DEFAULT 0 NOT NULL,\n\t\"completed_at\" timestamp with time zone,\n\t\"archived_at\" timestamp with time zone,\n\t\"created_by\" text DEFAULT 'user' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"issue_project_seq\" UNIQUE(\"project_id\",\"seq\")\n);",
      "CREATE TABLE \"issue_label\" (\n\t\"issue_id\" uuid NOT NULL,\n\t\"label_id\" uuid NOT NULL,\n\tCONSTRAINT \"issue_label_issue_id_label_id_pk\" PRIMARY KEY(\"issue_id\",\"label_id\")\n);",
      "CREATE TABLE \"issue_link\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"issue_id\" uuid NOT NULL,\n\t\"kind\" text DEFAULT 'url' NOT NULL,\n\t\"url\" text NOT NULL,\n\t\"title\" text DEFAULT '' NOT NULL,\n\t\"actor\" text DEFAULT 'user' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"issue_relation\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"issue_id\" uuid NOT NULL,\n\t\"related_issue_id\" uuid NOT NULL,\n\t\"type\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"issue_relation_unique\" UNIQUE(\"issue_id\",\"related_issue_id\",\"type\")\n);",
      "CREATE TABLE \"label\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"color\" text DEFAULT '#94a3b8' NOT NULL,\n\tCONSTRAINT \"label_project_name\" UNIQUE(\"project_id\",\"name\")\n);",
      "CREATE TABLE \"member\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"workspace_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"email\" text,\n\t\"kind\" text DEFAULT 'human' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"project\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"workspace_id\" uuid NOT NULL,\n\t\"identifier\" text NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"description\" text DEFAULT '' NOT NULL,\n\t\"color\" text DEFAULT '#6366f1' NOT NULL,\n\t\"issue_counter\" integer DEFAULT 0 NOT NULL,\n\t\"archived_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"project_workspace_identifier\" UNIQUE(\"workspace_id\",\"identifier\")\n);",
      "CREATE TABLE \"state\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"group\" text NOT NULL,\n\t\"color\" text NOT NULL,\n\t\"position\" double precision DEFAULT 0 NOT NULL,\n\t\"is_default\" integer DEFAULT 0 NOT NULL\n);",
      "CREATE TABLE \"workspace\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"slug\" text NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"workspace_slug_unique\" UNIQUE(\"slug\")\n);",
      "ALTER TABLE \"activity\" ADD CONSTRAINT \"activity_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"activity\" ADD CONSTRAINT \"activity_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"comment\" ADD CONSTRAINT \"comment_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue\" ADD CONSTRAINT \"issue_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue\" ADD CONSTRAINT \"issue_state_id_state_id_fk\" FOREIGN KEY (\"state_id\") REFERENCES \"public\".\"state\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"issue\" ADD CONSTRAINT \"issue_assignee_id_member_id_fk\" FOREIGN KEY (\"assignee_id\") REFERENCES \"public\".\"member\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"issue_label\" ADD CONSTRAINT \"issue_label_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue_label\" ADD CONSTRAINT \"issue_label_label_id_label_id_fk\" FOREIGN KEY (\"label_id\") REFERENCES \"public\".\"label\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue_link\" ADD CONSTRAINT \"issue_link_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue_relation\" ADD CONSTRAINT \"issue_relation_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue_relation\" ADD CONSTRAINT \"issue_relation_related_issue_id_issue_id_fk\" FOREIGN KEY (\"related_issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"label\" ADD CONSTRAINT \"label_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"member\" ADD CONSTRAINT \"member_workspace_id_workspace_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspace\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"project\" ADD CONSTRAINT \"project_workspace_id_workspace_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspace\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"state\" ADD CONSTRAINT \"state_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"activity_issue_idx\" ON \"activity\" USING btree (\"issue_id\");",
      "CREATE INDEX \"activity_project_idx\" ON \"activity\" USING btree (\"project_id\");",
      "CREATE INDEX \"comment_issue_idx\" ON \"comment\" USING btree (\"issue_id\");",
      "CREATE INDEX \"issue_project_state_idx\" ON \"issue\" USING btree (\"project_id\",\"state_id\");",
      "CREATE INDEX \"issue_parent_idx\" ON \"issue\" USING btree (\"parent_id\");",
      "CREATE INDEX \"issue_link_issue_idx\" ON \"issue_link\" USING btree (\"issue_id\");",
      "CREATE INDEX \"state_project_idx\" ON \"state\" USING btree (\"project_id\");"
    ],
    "bps": true,
    "folderMillis": 1793027946451,
    "hash": "2741195861ae0b1887151418833d94ac3d4c85d79781998de569f0bb833429a8"
  },
  {
    "sql": [
      "CREATE TABLE \"api_token\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"workspace_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"token_hash\" text NOT NULL,\n\t\"scope\" text DEFAULT 'read' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"last_used_at\" timestamp with time zone,\n\t\"revoked_at\" timestamp with time zone,\n\tCONSTRAINT \"api_token_token_hash_unique\" UNIQUE(\"token_hash\")\n);",
      "ALTER TABLE \"api_token\" ADD CONSTRAINT \"api_token_workspace_id_workspace_id_fk\" FOREIGN KEY (\"workspace_id\") REFERENCES \"public\".\"workspace\"(\"id\") ON DELETE cascade ON UPDATE no action;"
    ],
    "bps": true,
    "folderMillis": 1793029704331,
    "hash": "8b6bc66fb7b1fbb65c34fb126a3b943d3489033ddb0da17f14060e543c44a2fd"
  },
  {
    "sql": [
      "CREATE TABLE \"cycle\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"description\" text DEFAULT '' NOT NULL,\n\t\"start_date\" date,\n\t\"end_date\" date,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"cycle_project_name\" UNIQUE(\"project_id\",\"name\")\n);",
      "CREATE TABLE \"issue_module\" (\n\t\"issue_id\" uuid NOT NULL,\n\t\"module_id\" uuid NOT NULL,\n\tCONSTRAINT \"issue_module_issue_id_module_id_pk\" PRIMARY KEY(\"issue_id\",\"module_id\")\n);",
      "CREATE TABLE \"milestone\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"description\" text DEFAULT '' NOT NULL,\n\t\"target_date\" date,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"milestone_project_name\" UNIQUE(\"project_id\",\"name\")\n);",
      "CREATE TABLE \"module\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"description\" text DEFAULT '' NOT NULL,\n\t\"status\" text DEFAULT 'backlog' NOT NULL,\n\t\"start_date\" date,\n\t\"target_date\" date,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"module_project_name\" UNIQUE(\"project_id\",\"name\")\n);",
      "ALTER TABLE \"issue\" ADD COLUMN \"cycle_id\" uuid;",
      "ALTER TABLE \"issue\" ADD COLUMN \"milestone_id\" uuid;",
      "ALTER TABLE \"cycle\" ADD CONSTRAINT \"cycle_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue_module\" ADD CONSTRAINT \"issue_module_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue_module\" ADD CONSTRAINT \"issue_module_module_id_module_id_fk\" FOREIGN KEY (\"module_id\") REFERENCES \"public\".\"module\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"milestone\" ADD CONSTRAINT \"milestone_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"module\" ADD CONSTRAINT \"module_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"issue_module_module_idx\" ON \"issue_module\" USING btree (\"module_id\");",
      "ALTER TABLE \"issue\" ADD CONSTRAINT \"issue_cycle_id_cycle_id_fk\" FOREIGN KEY (\"cycle_id\") REFERENCES \"public\".\"cycle\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"issue\" ADD CONSTRAINT \"issue_milestone_id_milestone_id_fk\" FOREIGN KEY (\"milestone_id\") REFERENCES \"public\".\"milestone\"(\"id\") ON DELETE set null ON UPDATE no action;"
    ],
    "bps": true,
    "folderMillis": 1793030227082,
    "hash": "6bc6f58a3db8ad85d4ea439dbac3810531a478af7dada7acd06ac8c2b8ff2a38"
  },
  {
    "sql": [
      "CREATE TABLE \"page\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"content\" text DEFAULT '' NOT NULL,\n\t\"created_by\" text DEFAULT 'user' NOT NULL,\n\t\"archived_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"page_project_title\" UNIQUE(\"project_id\",\"title\")\n);",
      "CREATE TABLE \"page_issue_link\" (\n\t\"page_id\" uuid NOT NULL,\n\t\"issue_id\" uuid NOT NULL,\n\tCONSTRAINT \"page_issue_link_page_id_issue_id_pk\" PRIMARY KEY(\"page_id\",\"issue_id\")\n);",
      "CREATE TABLE \"page_page_link\" (\n\t\"page_id\" uuid NOT NULL,\n\t\"target_page_id\" uuid NOT NULL,\n\tCONSTRAINT \"page_page_link_page_id_target_page_id_pk\" PRIMARY KEY(\"page_id\",\"target_page_id\")\n);",
      "CREATE TABLE \"page_version\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"page_id\" uuid NOT NULL,\n\t\"title\" text NOT NULL,\n\t\"content\" text NOT NULL,\n\t\"actor\" text DEFAULT 'user' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "ALTER TABLE \"page\" ADD CONSTRAINT \"page_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"page_issue_link\" ADD CONSTRAINT \"page_issue_link_page_id_page_id_fk\" FOREIGN KEY (\"page_id\") REFERENCES \"public\".\"page\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"page_issue_link\" ADD CONSTRAINT \"page_issue_link_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"page_page_link\" ADD CONSTRAINT \"page_page_link_page_id_page_id_fk\" FOREIGN KEY (\"page_id\") REFERENCES \"public\".\"page\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"page_page_link\" ADD CONSTRAINT \"page_page_link_target_page_id_page_id_fk\" FOREIGN KEY (\"target_page_id\") REFERENCES \"public\".\"page\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"page_version\" ADD CONSTRAINT \"page_version_page_id_page_id_fk\" FOREIGN KEY (\"page_id\") REFERENCES \"public\".\"page\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"page_issue_link_issue_idx\" ON \"page_issue_link\" USING btree (\"issue_id\");",
      "CREATE INDEX \"page_page_link_target_idx\" ON \"page_page_link\" USING btree (\"target_page_id\");",
      "CREATE INDEX \"page_version_page_idx\" ON \"page_version\" USING btree (\"page_id\");"
    ],
    "bps": true,
    "folderMillis": 1793031760824,
    "hash": "b82e2056f3a9cd3d8b66c547f458a25f9aed97ccec157560eca787fcd1d2fb1e"
  },
  {
    "sql": [
      "CREATE TABLE \"saved_view\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"layout\" text DEFAULT 'list' NOT NULL,\n\t\"query\" text DEFAULT '' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"saved_view_project_name\" UNIQUE(\"project_id\",\"name\")\n);",
      "ALTER TABLE \"saved_view\" ADD CONSTRAINT \"saved_view_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;"
    ],
    "bps": true,
    "folderMillis": 1793032206833,
    "hash": "defd53e9c45082a8c71f55c0ec547c050a3db1b7f80a2f05a39cc28b12f1ba37"
  },
  {
    "sql": [
      "CREATE TABLE \"issue_property_value\" (\n\t\"issue_id\" uuid NOT NULL,\n\t\"property_id\" uuid NOT NULL,\n\t\"value\" jsonb NOT NULL,\n\tCONSTRAINT \"issue_property_value_issue_id_property_id_pk\" PRIMARY KEY(\"issue_id\",\"property_id\")\n);",
      "CREATE TABLE \"property_def\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"project_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"type\" text NOT NULL,\n\t\"options\" jsonb DEFAULT '[]'::jsonb NOT NULL,\n\t\"position\" double precision DEFAULT 0 NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"property_def_project_name\" UNIQUE(\"project_id\",\"name\")\n);",
      "ALTER TABLE \"issue_property_value\" ADD CONSTRAINT \"issue_property_value_issue_id_issue_id_fk\" FOREIGN KEY (\"issue_id\") REFERENCES \"public\".\"issue\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"issue_property_value\" ADD CONSTRAINT \"issue_property_value_property_id_property_def_id_fk\" FOREIGN KEY (\"property_id\") REFERENCES \"public\".\"property_def\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"property_def\" ADD CONSTRAINT \"property_def_project_id_project_id_fk\" FOREIGN KEY (\"project_id\") REFERENCES \"public\".\"project\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "CREATE INDEX \"issue_property_value_property_idx\" ON \"issue_property_value\" USING btree (\"property_id\");",
      "CREATE INDEX \"property_def_project_idx\" ON \"property_def\" USING btree (\"project_id\");"
    ],
    "bps": true,
    "folderMillis": 1793042091054,
    "hash": "237fa8cbb5d98219fd393286f600990ac9b511d8e5661e5d4bdbda3334b6ec1a"
  },
  {
    "sql": [
      "ALTER TABLE \"project\" ADD COLUMN \"status\" text;",
      "ALTER TABLE \"project\" ADD CONSTRAINT \"project_status_check\" CHECK (\"project\".\"status\" IN ('planned', 'active', 'paused', 'completed', 'cancelled'));"
    ],
    "bps": true,
    "folderMillis": 1793285162052,
    "hash": "60fb8cc60322815da94afe5c3010ee7c33b246d187a67f074d9a3beb0cc4efcf"
  }
] as const;
