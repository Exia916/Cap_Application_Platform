-- 018_playbooks_phase1.sql
-- Playbooks Phase 1
-- Database-driven knowledge module for Cap Applications Platform

BEGIN;

-- ---------------------------------------------------------------------------
-- playbook_departments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.playbook_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by text NULL
);

COMMENT ON TABLE public.playbook_departments IS
  'Top-level organizational groupings for playbooks such as Production, Warehouse, Maintenance, IT / Systems.';

COMMENT ON COLUMN public.playbook_departments.slug IS
  'Globally unique routing / lookup slug for the department.';

CREATE INDEX IF NOT EXISTS idx_playbook_departments_sort_order
  ON public.playbook_departments(sort_order);

CREATE INDEX IF NOT EXISTS idx_playbook_departments_is_active
  ON public.playbook_departments(is_active);

CREATE INDEX IF NOT EXISTS idx_playbook_departments_name
  ON public.playbook_departments(name);

-- ---------------------------------------------------------------------------
-- playbook_categories
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.playbook_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL
    REFERENCES public.playbook_departments(id)
    ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  description text NULL,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by text NULL,
  CONSTRAINT uq_playbook_categories_department_name UNIQUE (department_id, name),
  CONSTRAINT uq_playbook_categories_department_slug UNIQUE (department_id, slug)
);

COMMENT ON TABLE public.playbook_categories IS
  'Second-level organizational groupings for playbooks within a department.';

CREATE INDEX IF NOT EXISTS idx_playbook_categories_department_id
  ON public.playbook_categories(department_id);

CREATE INDEX IF NOT EXISTS idx_playbook_categories_sort_order
  ON public.playbook_categories(sort_order);

CREATE INDEX IF NOT EXISTS idx_playbook_categories_is_active
  ON public.playbook_categories(is_active);

CREATE INDEX IF NOT EXISTS idx_playbook_categories_name
  ON public.playbook_categories(name);

-- ---------------------------------------------------------------------------
-- playbook_articles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.playbook_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL
    REFERENCES public.playbook_departments(id)
    ON DELETE RESTRICT,
  category_id uuid NOT NULL
    REFERENCES public.playbook_categories(id)
    ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text NULL,
  article_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  content_markdown text NOT NULL,
  module_key text NULL,
  audience_role text NULL,
  is_featured boolean NOT NULL DEFAULT false,
  published_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_by text NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL,
  deleted_by text NULL,
  CONSTRAINT ck_playbook_articles_article_type
    CHECK (article_type IN (
      'application_guide',
      'job_function',
      'troubleshooting',
      'reference'
    )),
  CONSTRAINT ck_playbook_articles_status
    CHECK (status IN (
      'draft',
      'published',
      'archived'
    ))
);

COMMENT ON TABLE public.playbook_articles IS
  'Primary markdown-backed playbook articles. Supporting files attach via shared attachments service with entityType = playbook_article.';

COMMENT ON COLUMN public.playbook_articles.content_markdown IS
  'Primary markdown content body stored in PostgreSQL for Phase 1.';

COMMENT ON COLUMN public.playbook_articles.slug IS
  'Globally unique article slug for /playbooks/[slug] routing.';

CREATE INDEX IF NOT EXISTS idx_playbook_articles_department_id
  ON public.playbook_articles(department_id);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_category_id
  ON public.playbook_articles(category_id);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_article_type
  ON public.playbook_articles(article_type);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_status
  ON public.playbook_articles(status);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_is_featured
  ON public.playbook_articles(is_featured);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_published_at
  ON public.playbook_articles(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_module_key
  ON public.playbook_articles(module_key);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_is_deleted
  ON public.playbook_articles(is_deleted);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_title
  ON public.playbook_articles(title);

CREATE INDEX IF NOT EXISTS idx_playbook_articles_department_category
  ON public.playbook_articles(department_id, category_id);

-- Optional starter search helpers for Phase 1
CREATE INDEX IF NOT EXISTS idx_playbook_articles_slug_lower
  ON public.playbook_articles ((lower(slug)));

CREATE INDEX IF NOT EXISTS idx_playbook_articles_title_lower
  ON public.playbook_articles ((lower(title)));

-- ---------------------------------------------------------------------------
-- playbook_article_links
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.playbook_article_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL
    REFERENCES public.playbook_articles(id)
    ON DELETE CASCADE,
  related_article_id uuid NOT NULL
    REFERENCES public.playbook_articles(id)
    ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  created_by text NULL,
  CONSTRAINT uq_playbook_article_links_pair UNIQUE (article_id, related_article_id),
  CONSTRAINT ck_playbook_article_links_not_self CHECK (article_id <> related_article_id)
);

COMMENT ON TABLE public.playbook_article_links IS
  'Ordered related-article links between playbook articles.';

CREATE INDEX IF NOT EXISTS idx_playbook_article_links_article_id
  ON public.playbook_article_links(article_id);

CREATE INDEX IF NOT EXISTS idx_playbook_article_links_related_article_id
  ON public.playbook_article_links(related_article_id);

CREATE INDEX IF NOT EXISTS idx_playbook_article_links_sort_order
  ON public.playbook_article_links(article_id, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

INSERT INTO public.playbook_departments (
  name,
  slug,
  description,
  sort_order,
  is_active,
  created_by,
  updated_by
)
VALUES
  ('Production', 'production', 'Production work instructions and module guides.', 10, true, 'migration', 'migration'),
  ('Warehouse', 'warehouse', 'Warehouse process guides and operational references.', 20, true, 'migration', 'migration'),
  ('Maintenance', 'maintenance', 'Maintenance and CMMS related playbooks.', 30, true, 'migration', 'migration'),
  ('Customer Service', 'customer-service', 'Customer service workflows and references.', 40, true, 'migration', 'migration'),
  ('IT / Systems', 'it-systems', 'Application, hardware, and systems support guides.', 50, true, 'migration', 'migration'),
  ('Company / General', 'company-general', 'Company-wide guides and shared references.', 60, true, 'migration', 'migration')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW(),
  updated_by = EXCLUDED.updated_by;

INSERT INTO public.playbook_categories (
  department_id,
  name,
  slug,
  description,
  sort_order,
  is_active,
  created_by,
  updated_by
)
SELECT
  d.id,
  c.name,
  c.slug,
  c.description,
  c.sort_order,
  true,
  'migration',
  'migration'
FROM public.playbook_departments d
CROSS JOIN (
  VALUES
    ('Application Guides', 'application-guides', 'How-to guides for system usage.', 10),
    ('Job Function Guides', 'job-function-guides', 'Role/task-based work instructions.', 20),
    ('Troubleshooting', 'troubleshooting', 'Issue diagnosis and resolution guides.', 30),
    ('Reference', 'reference', 'Reference material, policies, and quick lookups.', 40)
) AS c(name, slug, description, sort_order)
ON CONFLICT (department_id, slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW(),
  updated_by = EXCLUDED.updated_by;

COMMIT;