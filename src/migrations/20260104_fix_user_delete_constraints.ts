import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fix foreign key constraints to allow user deletion
 * 
 * Problem: audit_logs, error_logs, and active_sessions have foreign keys to users
 * without ON DELETE behavior, which defaults to RESTRICT. This prevents user deletion.
 * 
 * Solution: Update constraints to ON DELETE SET NULL so logs are preserved but 
 * the user reference becomes null when a user is deleted.
 */

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Fix audit_logs foreign key
    ALTER TABLE "audit_logs" 
      DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";
    
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_user_id_fkey"
      FOREIGN KEY ("user_id") 
      REFERENCES "users"("id") 
      ON DELETE SET NULL;
    
    -- Fix error_logs foreign key
    ALTER TABLE "error_logs"
      DROP CONSTRAINT IF EXISTS "error_logs_user_id_fkey";
    
    ALTER TABLE "error_logs"
      ADD CONSTRAINT "error_logs_user_id_fkey"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL;
    
    -- Fix active_sessions foreign key
    ALTER TABLE "active_sessions"
      DROP CONSTRAINT IF EXISTS "active_sessions_user_id_fkey";
    
    ALTER TABLE "active_sessions"
      ADD CONSTRAINT "active_sessions_user_id_fkey"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id")
      ON DELETE SET NULL;
  `)
  
  console.log('✅ Updated foreign key constraints to allow user deletion')
}

export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    -- Revert audit_logs foreign key (back to RESTRICT)
    ALTER TABLE "audit_logs"
      DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";
    
    ALTER TABLE "audit_logs"
      ADD CONSTRAINT "audit_logs_user_id_fkey"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id");
    
    -- Revert error_logs foreign key
    ALTER TABLE "error_logs"
      DROP CONSTRAINT IF EXISTS "error_logs_user_id_fkey";
    
    ALTER TABLE "error_logs"
      ADD CONSTRAINT "error_logs_user_id_fkey"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id");
    
    -- Revert active_sessions foreign key
    ALTER TABLE "active_sessions"
      DROP CONSTRAINT IF EXISTS "active_sessions_user_id_fkey";
    
    ALTER TABLE "active_sessions"
      ADD CONSTRAINT "active_sessions_user_id_fkey"
      FOREIGN KEY ("user_id")
      REFERENCES "users"("id");
  `)
  
  console.log('⚠️  Reverted foreign key constraints (user deletion now restricted)')
}

