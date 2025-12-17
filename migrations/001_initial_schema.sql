-- ============================================
-- MIGRATION 001: Initial Schema
-- ============================================
-- Creates all tables for Elemental Website CMS
-- Generated: 2025-12-17
-- Description: Baseline schema for Payload CMS with PostgreSQL
-- ============================================

BEGIN;

-- ============================================
-- CORE TABLES
-- ============================================

-- Users table (authentication + roles)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL DEFAULT 'team-manager',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  email VARCHAR(255) NOT NULL UNIQUE,
  reset_password_token TEXT,
  reset_password_expiration TIMESTAMP WITH TIME ZONE,
  salt TEXT,
  hash TEXT,
  login_attempts INTEGER DEFAULT 0,
  lock_until TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Users sessions (for authentication)
CREATE TABLE IF NOT EXISTS users_sessions (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS users_sessions_parent_idx ON users_sessions(_parent_id);
CREATE INDEX IF NOT EXISTS users_sessions_order_idx ON users_sessions(_order);

-- Users relationships (assignedTeams)
CREATE TABLE IF NOT EXISTS users_rels (
  id SERIAL PRIMARY KEY,
  "order" INTEGER,
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  teams_id INTEGER -- FK added later after teams table exists
);

CREATE INDEX IF NOT EXISTS users_rels_parent_idx ON users_rels(parent_id);
CREATE INDEX IF NOT EXISTS users_rels_order_idx ON users_rels("order");
CREATE INDEX IF NOT EXISTS users_rels_path_idx ON users_rels(path);

-- Media table
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  alt VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  url VARCHAR(255),
  thumbnail_u_r_l VARCHAR(255),
  filename VARCHAR(255),
  mime_type VARCHAR(255),
  filesize INTEGER,
  width INTEGER,
  height INTEGER
);

CREATE INDEX IF NOT EXISTS media_created_at_idx ON media(created_at);
CREATE INDEX IF NOT EXISTS media_filename_idx ON media(filename);

-- People table
CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  photo_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
  twitter VARCHAR(255),
  twitch VARCHAR(255),
  youtube VARCHAR(255),
  instagram VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS people_created_at_idx ON people(created_at);
CREATE INDEX IF NOT EXISTS people_slug_idx ON people(slug);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo VARCHAR(255),  -- Changed to VARCHAR for file paths
  region VARCHAR(255),
  rating INTEGER,
  active BOOLEAN DEFAULT true,
  co_captain_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  slug VARCHAR(255) UNIQUE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS teams_created_at_idx ON teams(created_at);
CREATE INDEX IF NOT EXISTS teams_slug_idx ON teams(slug);
CREATE INDEX IF NOT EXISTS teams_active_idx ON teams(active);

-- Teams array fields (each array becomes a separate table)
CREATE TABLE IF NOT EXISTS teams_achievements (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  achievement VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS teams_achievements_parent_idx ON teams_achievements(_parent_id);
CREATE INDEX IF NOT EXISTS teams_achievements_order_idx ON teams_achievements(_order);

CREATE TABLE IF NOT EXISTS teams_manager (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS teams_manager_parent_idx ON teams_manager(_parent_id);
CREATE INDEX IF NOT EXISTS teams_manager_order_idx ON teams_manager(_order);

CREATE TABLE IF NOT EXISTS teams_coaches (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS teams_coaches_parent_idx ON teams_coaches(_parent_id);
CREATE INDEX IF NOT EXISTS teams_coaches_order_idx ON teams_coaches(_order);

CREATE TABLE IF NOT EXISTS teams_captain (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS teams_captain_parent_idx ON teams_captain(_parent_id);
CREATE INDEX IF NOT EXISTS teams_captain_order_idx ON teams_captain(_order);

CREATE TABLE IF NOT EXISTS teams_roster (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  role VARCHAR(255)  -- 'tank', 'dps', 'support'
);

CREATE INDEX IF NOT EXISTS teams_roster_parent_idx ON teams_roster(_parent_id);
CREATE INDEX IF NOT EXISTS teams_roster_order_idx ON teams_roster(_order);

CREATE TABLE IF NOT EXISTS teams_subs (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS teams_subs_parent_idx ON teams_subs(_parent_id);
CREATE INDEX IF NOT EXISTS teams_subs_order_idx ON teams_subs(_order);

-- Production staff table
CREATE TABLE IF NOT EXISTS production (
  id SERIAL PRIMARY KEY,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  display_name TEXT DEFAULT '[Untitled]',
  slug VARCHAR(255),
  type VARCHAR(255) NOT NULL,  -- 'caster', 'observer', 'producer', etc.
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS production_created_at_idx ON production(created_at);
CREATE INDEX IF NOT EXISTS production_person_id_idx ON production(person_id);

-- Organization staff table
CREATE TABLE IF NOT EXISTS organization_staff (
  id SERIAL PRIMARY KEY,
  person_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
  display_name TEXT DEFAULT '[Untitled]',
  slug VARCHAR(255),
  role VARCHAR(255),  -- 'ceo', 'manager', etc.
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_staff_created_at_idx ON organization_staff(created_at);
CREATE INDEX IF NOT EXISTS organization_staff_person_id_idx ON organization_staff(person_id);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  opponent VARCHAR(255),
  date TIMESTAMP WITH TIME ZONE,
  region VARCHAR(255),  -- 'NA', 'EMEA', 'SA'
  league VARCHAR(255),  -- 'Masters', 'Expert', 'Advanced', 'Open'
  season VARCHAR(255),
  status VARCHAR(255) DEFAULT 'scheduled',  -- 'scheduled', 'cancelled'
  score_elmt_score INTEGER,
  score_opponent_score INTEGER,
  stream_url VARCHAR(255),
  stream_streamed_by VARCHAR(255),
  faceit_lobby VARCHAR(255),
  vod VARCHAR(255),
  generate_slug BOOLEAN DEFAULT true,
  slug VARCHAR(255) UNIQUE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS matches_created_at_idx ON matches(created_at);
CREATE INDEX IF NOT EXISTS matches_date_idx ON matches(date);
CREATE INDEX IF NOT EXISTS matches_team_idx ON matches(team_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);

-- Matches array fields
CREATE TABLE IF NOT EXISTS matches_producers_observers (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES production(id) ON DELETE SET NULL,
  name VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS matches_producers_observers_parent_idx ON matches_producers_observers(_parent_id);
CREATE INDEX IF NOT EXISTS matches_producers_observers_order_idx ON matches_producers_observers(_order);

CREATE TABLE IF NOT EXISTS matches_casters (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  caster_id INTEGER REFERENCES production(id) ON DELETE SET NULL,
  name VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS matches_casters_parent_idx ON matches_casters(_parent_id);
CREATE INDEX IF NOT EXISTS matches_casters_order_idx ON matches_casters(_order);

-- Pages table (for CMS pages)
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255),
  published_at TIMESTAMP WITH TIME ZONE,
  slug VARCHAR(255) UNIQUE,
  slug_lock BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pages_created_at_idx ON pages(created_at);
CREATE INDEX IF NOT EXISTS pages_slug_idx ON pages(slug);

-- Pages blocks (for flexible content)
CREATE TABLE IF NOT EXISTS pages_blocks (
  id SERIAL PRIMARY KEY,
  _order INTEGER NOT NULL,
  _parent_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  block_type VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS pages_blocks_parent_idx ON pages_blocks(_parent_id);
CREATE INDEX IF NOT EXISTS pages_blocks_order_idx ON pages_blocks(_order);

-- ============================================
-- PAYLOAD INTERNAL TABLES
-- ============================================

-- Payload migrations table
CREATE TABLE IF NOT EXISTS payload_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE,
  batch INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Payload locked documents (for editing conflicts)
CREATE TABLE IF NOT EXISTS payload_locked_documents (
  id SERIAL PRIMARY KEY,
  global_slug VARCHAR(255),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payload_locked_documents_rels (
  id SERIAL PRIMARY KEY,
  "order" INTEGER,
  parent_id INTEGER NOT NULL REFERENCES payload_locked_documents(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL,
  pages_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
  people_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
  teams_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  matches_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
  production_id INTEGER REFERENCES production(id) ON DELETE CASCADE,
  organization_staff_id INTEGER REFERENCES organization_staff(id) ON DELETE CASCADE,
  users_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_parent_idx ON payload_locked_documents_rels(parent_id);

-- Payload preferences (user UI preferences)
CREATE TABLE IF NOT EXISTS payload_preferences (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payload_preferences_key_idx ON payload_preferences(key);
CREATE INDEX IF NOT EXISTS payload_preferences_user_idx ON payload_preferences(user_id);

CREATE TABLE IF NOT EXISTS payload_preferences_rels (
  id SERIAL PRIMARY KEY,
  "order" INTEGER,
  parent_id INTEGER NOT NULL REFERENCES payload_preferences(id) ON DELETE CASCADE,
  path VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS payload_preferences_rels_parent_idx ON payload_preferences_rels(parent_id);

-- ============================================
-- ADD DEFERRED FOREIGN KEYS
-- ============================================

-- Now add the FK from users_rels to teams (teams table now exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_rels_teams_id_fkey'
  ) THEN
    ALTER TABLE users_rels 
    ADD CONSTRAINT users_rels_teams_id_fkey 
    FOREIGN KEY (teams_id) REFERENCES teams(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_rels_teams_idx ON users_rels(teams_id);

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

\echo ''
\echo '=== Migration 001 Complete! ==='
\echo ''
\echo 'Tables created:'
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo ''
\echo 'Row counts:'
SELECT 
  'users' as table_name, COUNT(*) as rows FROM users
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'people', COUNT(*) FROM people
UNION ALL SELECT 'matches', COUNT(*) FROM matches
UNION ALL SELECT 'production', COUNT(*) FROM production
UNION ALL SELECT 'pages', COUNT(*) FROM pages;

\echo ''
\echo '=== Ready to use! ==='
\echo 'Next step: Visit https://elmt.gg/admin to create your first user'
\echo ''
