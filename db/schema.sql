-- Grant & Internship AI Scout - Supabase PostgreSQL Schema

-- 1. Create opportunities table
CREATE TABLE IF NOT EXISTS public.opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT,
    link TEXT,
    tags TEXT[] DEFAULT '{}',
    deadline TEXT DEFAULT 'TBD'
);

-- 2. Index for faster query performance and ordering
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at ON public.opportunities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_tags ON public.opportunities USING GIN (tags);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- 4. Create public read policy (Allow anonymous dashboard visitors to view opportunities)
DROP POLICY IF EXISTS "Allow public read access" ON public.opportunities;
CREATE POLICY "Allow public read access" ON public.opportunities 
    FOR SELECT 
    USING (true);
