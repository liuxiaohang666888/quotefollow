-- 007_add_scope_changes.sql
-- Add scope changes tracking

CREATE TABLE IF NOT EXISTS public.scope_changes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  additional_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ DEFAULT NULL,
  approved_at TIMESTAMPTZ DEFAULT NULL
);

-- Add trigger for updated_at
CREATE TRIGGER trg_scope_changes_touch
BEFORE UPDATE ON public.scope_changes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS policies
ALTER TABLE public.scope_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scope_changes_select_own" ON public.scope_changes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.account_id = auth.uid()));

CREATE POLICY "scope_changes_insert_own" ON public.scope_changes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.account_id = auth.uid()));

CREATE POLICY "scope_changes_update_own" ON public.scope_changes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND q.account_id = auth.uid()));

-- Add index
CREATE INDEX IF NOT EXISTS idx_scope_changes_quote ON public.scope_changes(quote_id);

-- Add original_amount to quotes for scope change tracking
-- (already added in 006 migration)
