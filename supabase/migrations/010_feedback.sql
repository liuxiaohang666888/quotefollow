-- 010_feedback.sql
-- Feedback / exit survey system

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  email TEXT,
  kind TEXT NOT NULL DEFAULT 'in_app' CHECK (kind IN ('in_app', 'exit')),
  reason TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- anyone (incl. logged-out users on the exit survey) can submit
CREATE POLICY "feedback_insert_any" ON public.feedback FOR INSERT WITH CHECK (true);

-- logged-in users can read their own submissions
CREATE POLICY "feedback_select_own" ON public.feedback FOR SELECT
  USING (auth.uid() = account_id);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.feedback(created_at DESC);
