CREATE TABLE "game" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"ms_per_day" integer NOT NULL,
	"ends_at" timestamp with time zone,
	"state" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_journal" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"seq" integer,
	"kind" text NOT NULL,
	"actor" jsonb,
	"user_id" text,
	"team_id" text,
	"command_type" text,
	"payload" jsonb,
	"ok" boolean NOT NULL,
	"refusal_code" text,
	"day" integer NOT NULL,
	"step" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game" ADD CONSTRAINT "game_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_journal" ADD CONSTRAINT "game_journal_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_journal_game_seq_idx" ON "game_journal" USING btree ("game_id","seq");