-- ============================================================================
-- PNC ALERTE (RDC) — EXTENSION SUPABASE POUR L'APPLICATION CITOYENNE
-- À exécuter dans Supabase -> SQL Editor APRÈS db/supabase_web_command.sql
-- Compatible PostgreSQL 15+ (REST API, Supabase Auth & Supabase Realtime)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. HELPER RBAC OPÉRATEURS (tous les opérateurs actifs du Commandement)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_pnc_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.pnc_operators
     WHERE uid = auth.uid()
       AND active = TRUE
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. EXTENSIONS NON-DESTRUCTIVES DES TABLES EXISTANTES DU COMMANDEMENT
-- ----------------------------------------------------------------------------
ALTER TABLE public.pnc_reports
  ALTER COLUMN created_by_uid DROP NOT NULL;

ALTER TABLE public.pnc_reports
  ADD COLUMN IF NOT EXISTS anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reporter_phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS eta_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS assigned_station_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validated_by TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validation_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE public.pnc_official_alerts
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'Kinshasa',
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS published_by TEXT NOT NULL DEFAULT 'Centre de Commandement PNC',
  ADD COLUMN IF NOT EXISTS full_details TEXT NOT NULL DEFAULT '';

ALTER TABLE public.pnc_facilities
  ADD COLUMN IF NOT EXISTS hours TEXT NOT NULL DEFAULT 'Ouvert 24h/24',
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'Opérationnel',
  ADD COLUMN IF NOT EXISTS active_units INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.pnc_complaints
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS date TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_label TEXT NOT NULL DEFAULT 'Reçue',
  ADD COLUMN IF NOT EXISTS attachments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_station TEXT NOT NULL DEFAULT 'En attente d’affectation (Centre de Commandement)',
  ADD COLUMN IF NOT EXISTS citizen_phone TEXT NOT NULL DEFAULT '';

-- ----------------------------------------------------------------------------
-- 3. TABLES CITOYENNES DÉDIÉES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pnc_citizens (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  commune TEXT NOT NULL DEFAULT 'Kinshasa',
  default_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnc_citizens_phone ON public.pnc_citizens (phone);

CREATE TABLE IF NOT EXISTS public.pnc_citizen_station_favorites (
  user_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id TEXT NOT NULL REFERENCES public.pnc_facilities(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_uid, station_id)
);

CREATE TABLE IF NOT EXISTS public.pnc_chat_messages (
  id TEXT PRIMARY KEY,
  report_id TEXT,
  citizen_uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'dispatch')),
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  time TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pnc_chat_citizen_uid ON public.pnc_chat_messages (citizen_uid, created_at);

CREATE TABLE IF NOT EXISTS public.pnc_notifications (
  id TEXT PRIMARY KEY,
  user_uid UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  target_screen TEXT
);

CREATE INDEX IF NOT EXISTS idx_pnc_notifications_user_uid ON public.pnc_notifications (user_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pnc_verifiable_documents (
  number TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  holder_name TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Valide', 'En cours', 'Expiré')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. RPC SÉCURISÉE POUR LA CARTE PUBLIQUE (SANS DONNÉES PERSONNELLES)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_map_incidents()
RETURNS TABLE (
  id TEXT,
  reference TEXT,
  type_label TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  date_time TEXT,
  status_label TEXT,
  is_sos BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    r.reference,
    r.type_label,
    r.location,
    r.latitude,
    r.longitude,
    r.date_time,
    r.status_label,
    r.is_sos
  FROM public.pnc_reports r
  WHERE r.status_key = 'encours'
  ORDER BY r.created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_map_incidents() TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. POLITIQUES ROW LEVEL SECURITY (RLS) CITOYEN <-> COMMANDEMENT
-- ----------------------------------------------------------------------------
ALTER TABLE public.pnc_citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnc_citizen_station_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnc_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnc_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnc_verifiable_documents ENABLE ROW LEVEL SECURITY;

-- Profils citoyens : lecture/mise à jour propre ou opérateur PNC
DROP POLICY IF EXISTS pnc_citizens_select ON public.pnc_citizens;
CREATE POLICY pnc_citizens_select ON public.pnc_citizens
  FOR SELECT USING (auth.uid() = uid OR public.is_pnc_operator());

DROP POLICY IF EXISTS pnc_citizens_insert ON public.pnc_citizens;
CREATE POLICY pnc_citizens_insert ON public.pnc_citizens
  FOR INSERT WITH CHECK (auth.uid() = uid);

DROP POLICY IF EXISTS pnc_citizens_update ON public.pnc_citizens;
CREATE POLICY pnc_citizens_update ON public.pnc_citizens
  FOR UPDATE USING (auth.uid() = uid OR public.is_pnc_operator())
  WITH CHECK (auth.uid() = uid OR public.is_pnc_operator());

-- Favoris commissariats : strictement personnels
DROP POLICY IF EXISTS pnc_fav_select ON public.pnc_citizen_station_favorites;
CREATE POLICY pnc_fav_select ON public.pnc_citizen_station_favorites
  FOR SELECT USING (auth.uid() = user_uid);

DROP POLICY IF EXISTS pnc_fav_insert ON public.pnc_citizen_station_favorites;
CREATE POLICY pnc_fav_insert ON public.pnc_citizen_station_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_uid);

DROP POLICY IF EXISTS pnc_fav_delete ON public.pnc_citizen_station_favorites;
CREATE POLICY pnc_fav_delete ON public.pnc_citizen_station_favorites
  FOR DELETE USING (auth.uid() = user_uid);

-- Signalements (pnc_reports) : citoyen propriétaire ou tout opérateur actif
DROP POLICY IF EXISTS pnc_reports_select ON public.pnc_reports;
CREATE POLICY pnc_reports_select ON public.pnc_reports
  FOR SELECT USING (auth.uid() = created_by_uid OR public.is_pnc_operator());

DROP POLICY IF EXISTS pnc_reports_insert ON public.pnc_reports;
CREATE POLICY pnc_reports_insert ON public.pnc_reports
  FOR INSERT WITH CHECK (auth.uid() = created_by_uid);

DROP POLICY IF EXISTS pnc_reports_update ON public.pnc_reports;
CREATE POLICY pnc_reports_update ON public.pnc_reports
  FOR UPDATE USING (auth.uid() = created_by_uid OR public.is_pnc_operator())
  WITH CHECK (auth.uid() = created_by_uid OR public.is_pnc_operator());

-- Plaintes (pnc_complaints) : citoyen propriétaire ou tout opérateur actif
DROP POLICY IF EXISTS pnc_complaints_select ON public.pnc_complaints;
CREATE POLICY pnc_complaints_select ON public.pnc_complaints
  FOR SELECT USING (auth.uid() = created_by_uid OR public.is_pnc_operator());

DROP POLICY IF EXISTS pnc_complaints_insert ON public.pnc_complaints;
CREATE POLICY pnc_complaints_insert ON public.pnc_complaints
  FOR INSERT WITH CHECK (auth.uid() = created_by_uid);

DROP POLICY IF EXISTS pnc_complaints_update ON public.pnc_complaints;
CREATE POLICY pnc_complaints_update ON public.pnc_complaints
  FOR UPDATE USING (auth.uid() = created_by_uid OR public.is_pnc_operator())
  WITH CHECK (auth.uid() = created_by_uid OR public.is_pnc_operator());

-- Alertes officielles : lisibles par tous les citoyens, écriture opérateur/propriétaire
DROP POLICY IF EXISTS pnc_official_alerts_select ON public.pnc_official_alerts;
CREATE POLICY pnc_official_alerts_select ON public.pnc_official_alerts
  FOR SELECT USING (TRUE);

-- Infrastructures / Commissariats : vérifiés lisibles par tous les citoyens
DROP POLICY IF EXISTS pnc_facilities_select ON public.pnc_facilities;
CREATE POLICY pnc_facilities_select ON public.pnc_facilities
  FOR SELECT USING (
    verification_status = 'verifie'
    OR auth.uid() = created_by_uid
    OR public.is_pnc_operator()
  );

-- Chat Dispatch : citoyen propriétaire ou opérateur actif
DROP POLICY IF EXISTS pnc_chat_select ON public.pnc_chat_messages;
CREATE POLICY pnc_chat_select ON public.pnc_chat_messages
  FOR SELECT USING (auth.uid() = citizen_uid OR public.is_pnc_operator());

DROP POLICY IF EXISTS pnc_chat_insert ON public.pnc_chat_messages;
CREATE POLICY pnc_chat_insert ON public.pnc_chat_messages
  FOR INSERT WITH CHECK (
    (sender = 'user' AND auth.uid() = citizen_uid)
    OR public.is_pnc_operator()
  );

-- Notifications citoyen
DROP POLICY IF EXISTS pnc_notifications_select ON public.pnc_notifications;
CREATE POLICY pnc_notifications_select ON public.pnc_notifications
  FOR SELECT USING (auth.uid() = user_uid OR public.is_pnc_operator());

DROP POLICY IF EXISTS pnc_notifications_insert ON public.pnc_notifications;
CREATE POLICY pnc_notifications_insert ON public.pnc_notifications
  FOR INSERT WITH CHECK (auth.uid() = user_uid OR public.is_pnc_operator());

DROP POLICY IF EXISTS pnc_notifications_update ON public.pnc_notifications;
CREATE POLICY pnc_notifications_update ON public.pnc_notifications
  FOR UPDATE USING (auth.uid() = user_uid OR public.is_pnc_operator())
  WITH CHECK (auth.uid() = user_uid OR public.is_pnc_operator());

-- Documents vérifiables
DROP POLICY IF EXISTS pnc_docs_select ON public.pnc_verifiable_documents;
CREATE POLICY pnc_docs_select ON public.pnc_verifiable_documents
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS pnc_docs_write ON public.pnc_verifiable_documents;
CREATE POLICY pnc_docs_write ON public.pnc_verifiable_documents
  FOR ALL USING (public.is_pnc_operator())
  WITH CHECK (public.is_pnc_operator());

-- ----------------------------------------------------------------------------
-- 6. ACTIVATION DE SUPABASE REALTIME SUR LES TABLES PARTAGÉES
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'pnc_reports',
    'pnc_official_alerts',
    'pnc_facilities',
    'pnc_complaints',
    'pnc_chat_messages',
    'pnc_notifications'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;

COMMIT;
