CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.user_security_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  question_order integer NOT NULL CHECK (question_order BETWEEN 1 AND 3),
  question_prompt text NOT NULL,
  answer_hash text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,

  UNIQUE (user_id, question_order)
);

CREATE INDEX IF NOT EXISTS idx_user_security_questions_user_id
  ON public.user_security_questions(user_id);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS security_questions_enrolled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS security_questions_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offsite_security_bypass_until timestamptz NULL;