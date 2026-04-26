import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Create enum for pug_players tiers
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_players_tiers" AS ENUM('open', 'invite');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create enum for pug_players approved_roles
    DO $$ BEGIN
      CREATE TYPE "public"."enum_pug_players_approved_roles" AS ENUM('tank', 'flex-dps', 'hitscan-dps', 'flex-support', 'main-support');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create main pug_players table
    CREATE TABLE IF NOT EXISTS "pug_players" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "registered_date" timestamp(3) with time zone,
      "invited_by_id" integer,
      "active_ban_banned_until" timestamp(3) with time zone,
      "active_ban_reason" varchar,
      "active_ban_offense_count" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- Create tiers junction table (hasMany select - uses parent_id/order without underscore prefix)
    CREATE TABLE IF NOT EXISTS "pug_players_tiers" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "value" "enum_pug_players_tiers"
    );

    -- Create approved_roles junction table (hasMany select - uses parent_id/order without underscore prefix)
    CREATE TABLE IF NOT EXISTS "pug_players_approved_roles" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "value" "enum_pug_players_approved_roles"
    );

    -- Add unique constraint on user_id
    DO $$ BEGIN
      ALTER TABLE "pug_players"
        ADD CONSTRAINT "pug_players_user_id_unique" UNIQUE ("user_id");
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for user
    DO $$ BEGIN
      ALTER TABLE "pug_players"
        ADD CONSTRAINT "pug_players_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for invited_by
    DO $$ BEGIN
      ALTER TABLE "pug_players"
        ADD CONSTRAINT "pug_players_invited_by_id_users_id_fk"
        FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for tiers
    DO $$ BEGIN
      ALTER TABLE "pug_players_tiers"
        ADD CONSTRAINT "pug_players_tiers_parent_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "pug_players"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Add foreign key for approved_roles
    DO $$ BEGIN
      ALTER TABLE "pug_players_approved_roles"
        ADD CONSTRAINT "pug_players_approved_roles_parent_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "pug_players"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- Create indexes
    CREATE INDEX IF NOT EXISTS "pug_players_user_idx" ON "pug_players" ("user_id");
    CREATE INDEX IF NOT EXISTS "pug_players_invited_by_idx" ON "pug_players" ("invited_by_id");
    CREATE INDEX IF NOT EXISTS "pug_players_created_at_idx" ON "pug_players" ("created_at");
    CREATE INDEX IF NOT EXISTS "pug_players_tiers_order_idx" ON "pug_players_tiers" ("order");
    CREATE INDEX IF NOT EXISTS "pug_players_tiers_parent_id_idx" ON "pug_players_tiers" ("parent_id");
    CREATE INDEX IF NOT EXISTS "pug_players_approved_roles_order_idx" ON "pug_players_approved_roles" ("order");
    CREATE INDEX IF NOT EXISTS "pug_players_approved_roles_parent_id_idx" ON "pug_players_approved_roles" ("parent_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS "pug_players_approved_roles";
    DROP TABLE IF EXISTS "pug_players_tiers";
    DROP TABLE IF EXISTS "pug_players";
    DROP TYPE IF EXISTS "public"."enum_pug_players_approved_roles";
    DROP TYPE IF EXISTS "public"."enum_pug_players_tiers";
  `)
}
