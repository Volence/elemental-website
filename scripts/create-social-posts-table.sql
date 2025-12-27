-- Create social_posts table with all necessary columns

CREATE TABLE IF NOT EXISTS social_posts (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    post_type VARCHAR(255) NOT NULL DEFAULT 'Original Content',
    platform VARCHAR(255) NOT NULL DEFAULT 'Twitter/X',
    scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'Draft',
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    related_match INTEGER REFERENCES matches(id) ON DELETE SET NULL,
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on scheduled_date for faster queries
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_date ON social_posts(scheduled_date);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);

-- Create index on assigned_to for user-specific queries
CREATE INDEX IF NOT EXISTS idx_social_posts_assigned_to ON social_posts(assigned_to);

-- Create social_posts_rels table for relationships (media attachments)
CREATE TABLE IF NOT EXISTS social_posts_rels (
    id SERIAL PRIMARY KEY,
    "order" INTEGER,
    parent_id INTEGER REFERENCES social_posts(id) ON DELETE CASCADE,
    path VARCHAR(255) NOT NULL,
    media_id INTEGER REFERENCES media(id) ON DELETE CASCADE
);

-- Create index on parent_id for faster relationship queries
CREATE INDEX IF NOT EXISTS idx_social_posts_rels_parent ON social_posts_rels(parent_id);

-- Verify tables were created
SELECT 
    schemaname,
    tablename 
FROM pg_tables 
WHERE tablename IN ('social_posts', 'social_posts_rels')
ORDER BY tablename;

-- Show column structure
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'social_posts'
ORDER BY ordinal_position;

