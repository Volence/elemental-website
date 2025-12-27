-- Create missing array tables for Social Media features

-- 1. Table for social_posts.mediaAttachments array field
CREATE TABLE IF NOT EXISTS social_posts_media_attachments (
    id SERIAL PRIMARY KEY,
    _order INTEGER NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    media_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    alt_text VARCHAR(255)
);

-- Create index for faster parent lookups
CREATE INDEX IF NOT EXISTS idx_social_posts_media_attachments_parent ON social_posts_media_attachments(_parent_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_media_attachments_order ON social_posts_media_attachments(_order);

-- 2. Table for social_media_settings.postTemplates array field
CREATE TABLE IF NOT EXISTS social_media_settings_post_templates (
    id SERIAL PRIMARY KEY,
    _order INTEGER NOT NULL,
    _parent_id INTEGER NOT NULL REFERENCES social_media_settings(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    post_type VARCHAR(255) NOT NULL,
    template_text TEXT NOT NULL,
    suggested_media TEXT
);

-- Create index for faster parent lookups
CREATE INDEX IF NOT EXISTS idx_social_media_settings_post_templates_parent ON social_media_settings_post_templates(_parent_id);
CREATE INDEX IF NOT EXISTS idx_social_media_settings_post_templates_order ON social_media_settings_post_templates(_order);

-- 3. Add missing columns to social_media_settings for weekly goals
ALTER TABLE social_media_settings 
ADD COLUMN IF NOT EXISTS weekly_goals_total_posts_per_week INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS weekly_goals_match_promos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_goals_stream_announcements INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_goals_community_engagement INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_goals_original_content INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS content_guidelines TEXT;

-- Verify tables were created
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename IN (
    'social_posts_media_attachments',
    'social_media_settings_post_templates'
)
ORDER BY tablename;

-- Show structure of new tables
\d social_posts_media_attachments
\d social_media_settings_post_templates

