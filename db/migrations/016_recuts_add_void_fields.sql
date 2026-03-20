ALTER TABLE public.recut_requests
  ADD COLUMN IF NOT EXISTS is_voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS voided_by text NULL,
  ADD COLUMN IF NOT EXISTS void_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_recut_requests_is_voided
  ON public.recut_requests (is_voided);

CREATE INDEX IF NOT EXISTS idx_recut_requests_active_requested_at
  ON public.recut_requests (requested_at DESC)
  WHERE is_voided = false;