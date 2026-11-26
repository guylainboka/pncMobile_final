import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type ReportStatus =
  | 'Nouvelle'
  | 'En vérification'
  | 'Confirmée'
  | 'Affectée à une équipe'
  | 'Intervention en cours'
  | 'Résolue'
  | 'Clôturée';

export type ComplaintStatus =
  | 'Reçue'
  | "En cours d'enquête"
  | 'Transmise au parquet'
  | 'Clôturée';

export interface MediaAttachment {
  id: string;
  type: 'photo' | 'video' | 'audio';
  name: string;
  sizeOrDuration: string;
  dataUrl?: string;
}

export interface SupabaseEnvConfig {
  configured: boolean;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  jwksUrl: string;
}

export function getSupabaseEnvConfig(): SupabaseEnvConfig {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const jwksUrl = (
    process.env.SUPABASE_JWKS_URL ||
    (url ? `${url}/auth/v1/.well-known/jwks.json` : '')
  ).trim();

  return {
    configured: Boolean(url && anonKey),
    url,
    anonKey,
    serviceRoleKey,
    jwksUrl,
  };
}

let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;
let cachedJwksUrl = '';
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

export function getAnonSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseEnvConfig();
  if (!cfg.configured) return null;
  if (!anonClient) {
    anonClient = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anonClient;
}

export function getServiceSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseEnvConfig();
  if (!cfg.configured || !cfg.serviceRoleKey) return null;
  if (!serviceClient) {
    serviceClient = createClient(cfg.url, cfg.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceClient;
}

export function getUserScopedSupabaseClient(accessToken?: string): SupabaseClient | null {
  const cfg = getSupabaseEnvConfig();
  if (!cfg.configured) return null;
  if (!accessToken) return getAnonSupabaseClient();
  return createClient(cfg.url, cfg.anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface VerifiedSupabaseIdentity {
  uid: string;
  email: string;
  phone: string;
  userMetadata: Record<string, unknown>;
}

export async function verifySupabaseToken(token: string): Promise<VerifiedSupabaseIdentity | null> {
  const cfg = getSupabaseEnvConfig();
  if (!cfg.configured || !token) return null;

  // 1. Try JWKS verification first (RS256/ES256 via SUPABASE_JWKS_URL)
  if (cfg.jwksUrl) {
    try {
      if (!cachedJwks || cachedJwksUrl !== cfg.jwksUrl) {
        cachedJwksUrl = cfg.jwksUrl;
        cachedJwks = createRemoteJWKSet(new URL(cfg.jwksUrl));
      }
      const { payload } = await jwtVerify(token, cachedJwks);
      if (typeof payload.sub === 'string' && payload.sub) {
        const meta =
          payload.user_metadata && typeof payload.user_metadata === 'object'
            ? (payload.user_metadata as Record<string, unknown>)
            : {};
        return {
          uid: payload.sub,
          email: typeof payload.email === 'string' ? payload.email : '',
          phone: typeof payload.phone === 'string' ? payload.phone : '',
          userMetadata: meta,
        };
      }
    } catch {
      // Fallback to Supabase Auth API (handles HS256 projects or key rotation)
    }
  }

  // 2. Fallback: verify via Supabase Auth HTTPS endpoint
  const client = getAnonSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;
    return {
      uid: data.user.id,
      email: data.user.email || '',
      phone: data.user.phone || '',
      userMetadata: (data.user.user_metadata as Record<string, unknown>) || {},
    };
  } catch {
    return null;
  }
}

export async function isActiveSupabaseOperator(
  uid: string,
  accessToken?: string
): Promise<{ ok: boolean; displayName?: string; role?: string }> {
  const client = getServiceSupabaseClient() || getUserScopedSupabaseClient(accessToken);
  if (!client) return { ok: false };
  const { data, error } = await client
    .from('pnc_operators')
    .select('uid, display_name, role, active')
    .eq('uid', uid)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) return { ok: false };
  return {
    ok: true,
    displayName: String(data.display_name || ''),
    role: String(data.role || ''),
  };
}

export function formatRelativeTimeFr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return "À l'instant";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

export function mapAdminReportStatusToCitizen(
  statusLabel?: unknown,
  statusKey?: unknown
): ReportStatus {
  const label = typeof statusLabel === 'string' ? statusLabel.trim() : '';
  const valid: ReportStatus[] = [
    'Nouvelle',
    'En vérification',
    'Confirmée',
    'Affectée à une équipe',
    'Intervention en cours',
    'Résolue',
    'Clôturée',
  ];
  if (valid.includes(label as ReportStatus)) {
    return label as ReportStatus;
  }
  if (statusKey === 'cloturee' || label === 'Clôturée' || label === 'Clôturé') {
    return 'Clôturée';
  }
  if (statusKey === 'encours' || label === 'En cours') {
    return 'Intervention en cours';
  }
  return 'Nouvelle';
}

export function mapCitizenStatusToAdminKey(status: ReportStatus): 'attente' | 'encours' | 'cloturee' {
  if (status === 'Résolue' || status === 'Clôturée') return 'cloturee';
  if (status === 'Confirmée' || status === 'Affectée à une équipe' || status === 'Intervention en cours') {
    return 'encours';
  }
  return 'attente';
}

function parseGpsCoords(gps: unknown): { lat?: number; lng?: number } {
  if (typeof gps !== 'string' || !gps.includes(',')) return {};
  const [latStr, lngStr] = gps.split(',');
  const lat = Number(latStr.trim());
  const lng = Number(lngStr.trim());
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  return {};
}

function parseEtaMinutes(eta: unknown): number | undefined {
  if (typeof eta !== 'string' || !eta.trim()) return undefined;
  const match = eta.match(/\d+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
}

export function supabaseRowToReport(row: Record<string, unknown>) {
  const status = mapAdminReportStatusToCitizen(row.status_label, row.status_key);
  const filterKey: 'encours' | 'cloturee' =
    row.status_key === 'cloturee' || status === 'Résolue' || status === 'Clôturée'
      ? 'cloturee'
      : 'encours';
  const gpsParsed = parseGpsCoords(row.gps);
  const latitude = typeof row.latitude === 'number' ? row.latitude : gpsParsed.lat;
  const longitude = typeof row.longitude === 'number' ? row.longitude : gpsParsed.lng;
  const anonymous = Boolean(row.anonymous);
  const attachments = Array.isArray(row.attachments_json)
    ? (row.attachments_json as MediaAttachment[])
    : [];

  return {
    id: String(row.id),
    reference: String(row.reference),
    category: String(row.type_label || 'Incident'),
    description: String(row.description || ''),
    location: String(row.location || row.commune || 'Kinshasa'),
    latitude,
    longitude,
    timestamp: String(row.date_time || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
    status,
    filterKey,
    anonymous,
    reporterId: row.created_by_uid ? String(row.created_by_uid) : undefined,
    reporterName: anonymous ? undefined : row.reporter ? String(row.reporter) : undefined,
    reporterPhone: anonymous ? undefined : row.reporter_phone ? String(row.reporter_phone) : undefined,
    attachments,
    etaMinutes:
      typeof row.eta_minutes === 'number' ? row.eta_minutes : parseEtaMinutes(row.eta),
    patrolUnit: row.assigned_unit ? String(row.assigned_unit) : undefined,
    assignedStationId: row.assigned_station_id
      ? String(row.assigned_station_id)
      : row.nearest_station
        ? String(row.nearest_station)
        : undefined,
    validatedBy: row.validated_by ? String(row.validated_by) : undefined,
    validationNotes: row.validation_notes ? String(row.validation_notes) : undefined,
    isSos: Boolean(row.is_sos),
  };
}

export function supabaseRowToAlert(row: Record<string, unknown>) {
  const rawCat = String(row.category || 'Info');
  const category: 'securite' | 'avis' | 'info' =
    rawCat === 'Sécurité' ? 'securite' : rawCat === 'Avis' ? 'avis' : 'info';
  const icons: Record<'securite' | 'avis' | 'info', string> = {
    securite: 'warning',
    avis: 'search',
    info: 'campaign',
  };
  const createdAt = String(row.created_at || new Date().toISOString());
  const rawPrio = String(row.priority || 'normal');
  const priority: 'high' | 'medium' | 'normal' =
    rawPrio === 'high' || rawPrio === 'medium' ? rawPrio : 'normal';

  return {
    id: String(row.id),
    title: String(row.title),
    category,
    categoryLabel: rawCat,
    summary: String(row.message || ''),
    fullDetails: String(row.full_details || row.message || ''),
    location: String(row.location || 'Kinshasa'),
    createdAt,
    timeAgo: formatRelativeTimeFr(createdAt),
    icon: icons[category],
    priority,
    publishedBy: String(row.published_by || 'Centre de Commandement PNC'),
  };
}

export function supabaseFacilityToStation(
  row: Record<string, unknown>,
  favoriteIds?: Set<string>
) {
  const id = String(row.id);
  const verif = String(row.verification_status || 'a_verifier');
  const opStatus =
    row.operational_status === 'Alerte renforcée' ||
    row.operational_status === 'Maintenance' ||
    row.operational_status === 'Opérationnel'
      ? row.operational_status
      : verif === 'verifie'
        ? 'Opérationnel'
        : verif === 'desactive'
          ? 'Maintenance'
          : 'Alerte renforcée';

  return {
    id,
    name: String(row.name),
    address: String(row.address || row.quarter_or_village || row.commune_or_sector || ''),
    commune: String(row.commune_or_sector || row.city_or_territory || row.province_name || 'Kinshasa'),
    phone: String(row.phone_number || '112'),
    hours: String(row.hours || 'Ouvert 24h/24'),
    isFavorite: favoriteIds ? favoriteIds.has(id) : false,
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
    operationalStatus: opStatus as 'Opérationnel' | 'Alerte renforcée' | 'Maintenance',
    activeUnits: Number(row.active_units || 0),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export function supabaseRowToComplaint(row: Record<string, unknown>) {
  const rawLabel = typeof row.status_label === 'string' && row.status_label.trim() ? row.status_label.trim() : '';
  const validStatuses: ComplaintStatus[] = [
    'Reçue',
    "En cours d'enquête",
    'Transmise au parquet',
    'Clôturée',
  ];
  const status: ComplaintStatus = validStatuses.includes(rawLabel as ComplaintStatus)
    ? (rawLabel as ComplaintStatus)
    : row.status === 'traitee'
      ? 'Clôturée'
      : 'Reçue';

  const createdAt = String(row.created_at || new Date().toISOString());
  const attachments = Array.isArray(row.attachments_json)
    ? (row.attachments_json as unknown[]).map((a) => String(a))
    : [];

  return {
    id: String(row.id),
    reference: String(row.reference),
    type: String(row.type || row.subject || 'Plainte'),
    location: String(row.location || 'Kinshasa'),
    description: String(row.description || row.subject || ''),
    date: String(row.date || new Date(createdAt).toLocaleDateString('fr-FR')),
    createdAt,
    status,
    attachments,
    assignedStation: String(
      row.assigned_station || 'En attente d’affectation (Centre de Commandement)'
    ),
    citizenId: String(row.created_by_uid || ''),
    citizenName: String(row.citizen || ''),
    citizenPhone: String(row.citizen_phone || ''),
  };
}

export function supabaseRowToCitizen(row: Record<string, unknown>) {
  return {
    id: String(row.uid),
    fullName: String(row.full_name || ''),
    phone: String(row.phone || ''),
    email: String(row.email || ''),
    commune: String(row.commune || 'Kinshasa'),
    defaultAnonymous: Boolean(row.default_anonymous),
    active: row.active !== false,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function supabaseRowToChatMessage(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    reportId: row.report_id ? String(row.report_id) : undefined,
    citizenId: row.citizen_uid ? String(row.citizen_uid) : undefined,
    sender: (row.sender === 'dispatch' ? 'dispatch' : 'user') as 'user' | 'dispatch',
    senderName: String(row.sender_name || ''),
    text: String(row.text || ''),
    time: String(row.time || ''),
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

export function supabaseRowToNotification(row: Record<string, unknown>) {
  const createdAt = String(row.created_at || new Date().toISOString());
  return {
    id: String(row.id),
    userId: String(row.user_uid || ''),
    title: String(row.title || ''),
    body: String(row.body || ''),
    createdAt,
    time: formatRelativeTimeFr(createdAt),
    read: Boolean(row.read),
    targetScreen: row.target_screen ? String(row.target_screen) : undefined,
  };
}
