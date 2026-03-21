
-- Create family_members table
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  birth_date DATE,
  gender TEXT,
  blood_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- Users can view their own family members
CREATE POLICY "Users can view own family members"
ON public.family_members FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own family members
CREATE POLICY "Users can insert own family members"
ON public.family_members FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own family members
CREATE POLICY "Users can update own family members"
ON public.family_members FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own family members
CREATE POLICY "Users can delete own family members"
ON public.family_members FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Index for faster queries by user
CREATE INDEX idx_family_members_user_id ON public.family_members(user_id);
