import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Add avatar field to users table
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_id" integer;
    
    -- Add foreign key constraint
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_avatar_id_media_id_fk'
      ) THEN
        ALTER TABLE "users" 
          ADD CONSTRAINT "users_avatar_id_media_id_fk" 
          FOREIGN KEY ("avatar_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;
    
    -- Add index for performance
    CREATE INDEX IF NOT EXISTS "users_avatar_idx" ON "users" USING btree ("avatar_id");
  `)
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Remove index
    DROP INDEX IF EXISTS "users_avatar_idx";
    
    -- Remove foreign key constraint
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_avatar_id_media_id_fk";
    
    -- Remove avatar column
    ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_id";
  `)
}

