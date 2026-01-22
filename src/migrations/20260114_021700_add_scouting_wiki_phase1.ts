import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  // Create Heroes table
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS heroes (
      id serial PRIMARY KEY,
      name varchar NOT NULL UNIQUE,
      role varchar NOT NULL,
      active boolean DEFAULT true,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS heroes_name_idx ON heroes USING btree (name);
    CREATE INDEX IF NOT EXISTS heroes_role_idx ON heroes USING btree (role);
    CREATE INDEX IF NOT EXISTS heroes_created_at_idx ON heroes USING btree (created_at);
  `)

  // Create OpponentTeams table
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS opponent_teams (
      id serial PRIMARY KEY,
      name varchar NOT NULL,
      rank varchar,
      status varchar DEFAULT 'active',
      region varchar,
      contact varchar,
      general_notes jsonb,
      archived_at timestamp with time zone,
      updated_at timestamp with time zone DEFAULT now() NOT NULL,
      created_at timestamp with time zone DEFAULT now() NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS opponent_teams_name_idx ON opponent_teams USING btree (name);
    CREATE INDEX IF NOT EXISTS opponent_teams_status_idx ON opponent_teams USING btree (status);
    CREATE INDEX IF NOT EXISTS opponent_teams_created_at_idx ON opponent_teams USING btree (created_at);
  `)

  // Create opponent_teams_previous_names (array table)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS opponent_teams_previous_names (
      id varchar PRIMARY KEY NOT NULL,
      _order integer NOT NULL,
      _parent_id integer NOT NULL,
      name varchar,
      changed_date timestamp with time zone
    );
    
    ALTER TABLE opponent_teams_previous_names 
      ADD CONSTRAINT opponent_teams_previous_names_parent_fk 
      FOREIGN KEY (_parent_id) REFERENCES opponent_teams(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    
    CREATE INDEX IF NOT EXISTS opponent_teams_previous_names_order_idx ON opponent_teams_previous_names USING btree (_order);
    CREATE INDEX IF NOT EXISTS opponent_teams_previous_names_parent_idx ON opponent_teams_previous_names USING btree (_parent_id);
  `)

  // Create opponent_teams_current_roster (array table)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS opponent_teams_current_roster (
      id varchar PRIMARY KEY NOT NULL,
      _order integer NOT NULL,
      _parent_id integer NOT NULL,
      person_id integer,
      position varchar,
      player_notes text
    );
    
    ALTER TABLE opponent_teams_current_roster 
      ADD CONSTRAINT opponent_teams_current_roster_parent_fk 
      FOREIGN KEY (_parent_id) REFERENCES opponent_teams(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    
    ALTER TABLE opponent_teams_current_roster 
      ADD CONSTRAINT opponent_teams_current_roster_person_fk 
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL ON UPDATE NO ACTION;
    
    CREATE INDEX IF NOT EXISTS opponent_teams_current_roster_order_idx ON opponent_teams_current_roster USING btree (_order);
    CREATE INDEX IF NOT EXISTS opponent_teams_current_roster_parent_idx ON opponent_teams_current_roster USING btree (_parent_id);
    CREATE INDEX IF NOT EXISTS opponent_teams_current_roster_person_idx ON opponent_teams_current_roster USING btree (person_id);
  `)

  // Create opponent_teams_previous_roster (array table)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS opponent_teams_previous_roster (
      id varchar PRIMARY KEY NOT NULL,
      _order integer NOT NULL,
      _parent_id integer NOT NULL,
      person_id integer,
      position varchar,
      left_date timestamp with time zone,
      notes text
    );
    
    ALTER TABLE opponent_teams_previous_roster 
      ADD CONSTRAINT opponent_teams_previous_roster_parent_fk 
      FOREIGN KEY (_parent_id) REFERENCES opponent_teams(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    
    ALTER TABLE opponent_teams_previous_roster 
      ADD CONSTRAINT opponent_teams_previous_roster_person_fk 
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL ON UPDATE NO ACTION;
    
    CREATE INDEX IF NOT EXISTS opponent_teams_previous_roster_order_idx ON opponent_teams_previous_roster USING btree (_order);
    CREATE INDEX IF NOT EXISTS opponent_teams_previous_roster_parent_idx ON opponent_teams_previous_roster USING btree (_parent_id);
    CREATE INDEX IF NOT EXISTS opponent_teams_previous_roster_person_idx ON opponent_teams_previous_roster USING btree (person_id);
  `)

  // Create map_pool global table
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS map_pool (
      id serial PRIMARY KEY,
      updated_at timestamp with time zone,
      created_at timestamp with time zone
    );
    
    -- Insert initial row for global
    INSERT INTO map_pool (id, updated_at, created_at) 
    VALUES (1, now(), now())
    ON CONFLICT (id) DO NOTHING;
  `)

  // Create map_pool_maps (array table)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS map_pool_maps (
      id varchar PRIMARY KEY NOT NULL,
      _order integer NOT NULL,
      _parent_id integer NOT NULL,
      name varchar,
      type varchar
    );
    
    ALTER TABLE map_pool_maps 
      ADD CONSTRAINT map_pool_maps_parent_fk 
      FOREIGN KEY (_parent_id) REFERENCES map_pool(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    
    CREATE INDEX IF NOT EXISTS map_pool_maps_order_idx ON map_pool_maps USING btree (_order);
    CREATE INDEX IF NOT EXISTS map_pool_maps_parent_idx ON map_pool_maps USING btree (_parent_id);
  `)

  // Create map_pool_maps_submaps (nested array table)
  await payload.db.drizzle.execute(sql`
    CREATE TABLE IF NOT EXISTS map_pool_maps_submaps (
      id varchar PRIMARY KEY NOT NULL,
      _order integer NOT NULL,
      _parent_id varchar NOT NULL,
      name varchar
    );
    
    ALTER TABLE map_pool_maps_submaps 
      ADD CONSTRAINT map_pool_maps_submaps_parent_fk 
      FOREIGN KEY (_parent_id) REFERENCES map_pool_maps(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    
    CREATE INDEX IF NOT EXISTS map_pool_maps_submaps_order_idx ON map_pool_maps_submaps USING btree (_order);
    CREATE INDEX IF NOT EXISTS map_pool_maps_submaps_parent_idx ON map_pool_maps_submaps USING btree (_parent_id);
  `)

  // Add heroes to payload_locked_documents_rels
  await payload.db.drizzle.execute(sql`
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS heroes_id integer;
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS opponent_teams_id integer;
  `)

}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    DROP TABLE IF EXISTS map_pool_maps_submaps CASCADE;
    DROP TABLE IF EXISTS map_pool_maps CASCADE;
    DROP TABLE IF EXISTS map_pool CASCADE;
    DROP TABLE IF EXISTS opponent_teams_previous_roster CASCADE;
    DROP TABLE IF EXISTS opponent_teams_current_roster CASCADE;
    DROP TABLE IF EXISTS opponent_teams_previous_names CASCADE;
    DROP TABLE IF EXISTS opponent_teams CASCADE;
    DROP TABLE IF EXISTS heroes CASCADE;
    
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS heroes_id;
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS opponent_teams_id;
  `)
}
