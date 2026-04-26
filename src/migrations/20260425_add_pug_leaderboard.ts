import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Create enum for pug-leaderboard tier
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_leaderboard_tier" AS ENUM('open', 'invite');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create main pug_leaderboard table
    CREATE TABLE IF NOT EXISTS "pug_leaderboard" (
      "id" serial PRIMARY KEY NOT NULL,
      "player_id" integer NOT NULL,
      "season_id" integer NOT NULL,
      "tier" "enum_pug_leaderboard_tier" NOT NULL,
      "rating" numeric DEFAULT 1500,
      "rating_deviation" numeric DEFAULT 350,
      "volatility" numeric DEFAULT 0.06,
      "wins" integer DEFAULT 0,
      "losses" integer DEFAULT 0,
      "draws" integer DEFAULT 0,
      "games_played" integer DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Add foreign key constraints
    DO $$ BEGIN
      ALTER TABLE "pug_leaderboard"
        ADD CONSTRAINT "pug_leaderboard_player_id_fk"
        FOREIGN KEY ("player_id") REFERENCES "pug_players"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "pug_leaderboard"
        ADD CONSTRAINT "pug_leaderboard_season_id_fk"
        FOREIGN KEY ("season_id") REFERENCES "pug_seasons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "pug_leaderboard_player_idx" ON "pug_leaderboard" ("player_id");
    CREATE INDEX IF NOT EXISTS "pug_leaderboard_season_idx" ON "pug_leaderboard" ("season_id");
    CREATE INDEX IF NOT EXISTS "pug_leaderboard_created_at_idx" ON "pug_leaderboard" ("created_at");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "pug_leaderboard";
    DROP TYPE IF EXISTS "public"."enum_pug_leaderboard_tier";
  `)
}
