import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Create enum for pug_matches tier
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_matches_tier" AS ENUM('open', 'invite');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create enum for pug_matches result
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_matches_result" AS ENUM('team1', 'team2', 'draw', 'cancelled');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create enum for team players assigned_role
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_matches_team1_players_assigned_role" AS ENUM('tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_matches_team2_players_assigned_role" AS ENUM('tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create main pug_matches table
    CREATE TABLE IF NOT EXISTS "pug_matches" (
      "id" serial PRIMARY KEY NOT NULL,
      "lobby_number" numeric NOT NULL,
      "tier" "enum_pug_matches_tier" NOT NULL,
      "result" "enum_pug_matches_result",
      "date" timestamp(3) with time zone,
      "season_id" integer,
      "prisma_lobby_id" numeric,
      "map_played_id" integer,
      "reported_by_id" integer,
      "confirmed_by_id" integer,
      "disputed" boolean DEFAULT false,
      "dispute_resolution_resolved_by_id" integer,
      "dispute_resolution_resolution" varchar,
      "dispute_resolution_notes" varchar,
      "draft_order" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Create team1_players array table
    CREATE TABLE IF NOT EXISTS "pug_matches_team1_players" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "player_id" integer NOT NULL,
      "assigned_role" "enum_pug_matches_team1_players_assigned_role" NOT NULL,
      "is_captain" boolean DEFAULT false
    );

    -- Create team2_players array table
    CREATE TABLE IF NOT EXISTS "pug_matches_team2_players" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "player_id" integer NOT NULL,
      "assigned_role" "enum_pug_matches_team2_players_assigned_role" NOT NULL,
      "is_captain" boolean DEFAULT false
    );

    -- Create hero_bans array table
    CREATE TABLE IF NOT EXISTS "pug_matches_hero_bans" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "hero_id" integer NOT NULL,
      "team" numeric NOT NULL,
      "ban_order" numeric NOT NULL
    );

    -- Add foreign key for season
    DO $$ BEGIN
      ALTER TABLE "pug_matches"
        ADD CONSTRAINT "pug_matches_season_id_pug_seasons_id_fk"
        FOREIGN KEY ("season_id") REFERENCES "pug_seasons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for map_played
    DO $$ BEGIN
      ALTER TABLE "pug_matches"
        ADD CONSTRAINT "pug_matches_map_played_id_maps_id_fk"
        FOREIGN KEY ("map_played_id") REFERENCES "maps"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for reported_by
    DO $$ BEGIN
      ALTER TABLE "pug_matches"
        ADD CONSTRAINT "pug_matches_reported_by_id_users_id_fk"
        FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for confirmed_by
    DO $$ BEGIN
      ALTER TABLE "pug_matches"
        ADD CONSTRAINT "pug_matches_confirmed_by_id_users_id_fk"
        FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for dispute_resolution resolved_by
    DO $$ BEGIN
      ALTER TABLE "pug_matches"
        ADD CONSTRAINT "pug_matches_dispute_resolution_resolved_by_id_users_id_fk"
        FOREIGN KEY ("dispute_resolution_resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for team1_players parent
    DO $$ BEGIN
      ALTER TABLE "pug_matches_team1_players"
        ADD CONSTRAINT "pug_matches_team1_players_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pug_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for team1_players player
    DO $$ BEGIN
      ALTER TABLE "pug_matches_team1_players"
        ADD CONSTRAINT "pug_matches_team1_players_player_id_pug_players_id_fk"
        FOREIGN KEY ("player_id") REFERENCES "pug_players"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for team2_players parent
    DO $$ BEGIN
      ALTER TABLE "pug_matches_team2_players"
        ADD CONSTRAINT "pug_matches_team2_players_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pug_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for team2_players player
    DO $$ BEGIN
      ALTER TABLE "pug_matches_team2_players"
        ADD CONSTRAINT "pug_matches_team2_players_player_id_pug_players_id_fk"
        FOREIGN KEY ("player_id") REFERENCES "pug_players"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for hero_bans parent
    DO $$ BEGIN
      ALTER TABLE "pug_matches_hero_bans"
        ADD CONSTRAINT "pug_matches_hero_bans_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pug_matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for hero_bans hero
    DO $$ BEGIN
      ALTER TABLE "pug_matches_hero_bans"
        ADD CONSTRAINT "pug_matches_hero_bans_hero_id_heroes_id_fk"
        FOREIGN KEY ("hero_id") REFERENCES "heroes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "pug_matches_season_idx" ON "pug_matches" ("season_id");
    CREATE INDEX IF NOT EXISTS "pug_matches_map_played_idx" ON "pug_matches" ("map_played_id");
    CREATE INDEX IF NOT EXISTS "pug_matches_reported_by_idx" ON "pug_matches" ("reported_by_id");
    CREATE INDEX IF NOT EXISTS "pug_matches_confirmed_by_idx" ON "pug_matches" ("confirmed_by_id");
    CREATE INDEX IF NOT EXISTS "pug_matches_created_at_idx" ON "pug_matches" ("created_at");

    CREATE INDEX IF NOT EXISTS "pug_matches_team1_players_order_idx" ON "pug_matches_team1_players" ("_order");
    CREATE INDEX IF NOT EXISTS "pug_matches_team1_players_parent_id_idx" ON "pug_matches_team1_players" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pug_matches_team1_players_player_idx" ON "pug_matches_team1_players" ("player_id");

    CREATE INDEX IF NOT EXISTS "pug_matches_team2_players_order_idx" ON "pug_matches_team2_players" ("_order");
    CREATE INDEX IF NOT EXISTS "pug_matches_team2_players_parent_id_idx" ON "pug_matches_team2_players" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pug_matches_team2_players_player_idx" ON "pug_matches_team2_players" ("player_id");

    CREATE INDEX IF NOT EXISTS "pug_matches_hero_bans_order_idx" ON "pug_matches_hero_bans" ("_order");
    CREATE INDEX IF NOT EXISTS "pug_matches_hero_bans_parent_id_idx" ON "pug_matches_hero_bans" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "pug_matches_hero_bans_hero_idx" ON "pug_matches_hero_bans" ("hero_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "pug_matches_hero_bans";
    DROP TABLE IF EXISTS "pug_matches_team2_players";
    DROP TABLE IF EXISTS "pug_matches_team1_players";
    DROP TABLE IF EXISTS "pug_matches";
    DROP TYPE IF EXISTS "public"."enum_pug_matches_team2_players_assigned_role";
    DROP TYPE IF EXISTS "public"."enum_pug_matches_team1_players_assigned_role";
    DROP TYPE IF EXISTS "public"."enum_pug_matches_result";
    DROP TYPE IF EXISTS "public"."enum_pug_matches_tier";
  `)
}
