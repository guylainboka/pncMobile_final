import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { type SupabaseClient } from '@supabase/supabase-js';
import {
  getAnonSupabaseClient,
  getServiceSupabaseClient,
  getSupabaseEnvConfig,
  getUserScopedSupabaseClient,
  isActiveSupabaseOperator,
  mapCitizenStatusToAdminKey,
  supabaseFacilityToStation,
  supabaseRowToAlert,
  supabaseRowToChatMessage,
  supabaseRowToCitizen,
  supabaseRowToComplaint,
  supabaseRowToNotification,
  supabaseRowToReport,
  verifySupabaseToken,
  type ComplaintStatus,
  type MediaAttachment,
  type ReportStatus,
  type VerifiedSupabaseIdentity,
} from './supabaseBridge.ts';

interface CitizenAuthRequest extends Request {
  sbUser?: VerifiedSupabaseIdentity;
  sbToken?: string;
  sbClient?: SupabaseClient;
}

interface CommandAuthRequest extends Request {
  commandOperator?: { uid: string; displayName?: string; role?: string };
  commandClient?: SupabaseClient;
}

export interface SupabaseRouterHooks {
  broadcastAll: (event: string, payload: unknown) => void;
  broadcastToCommandAndUser: (userId: string | undefined, event: string, payload: unknown) => void;
  broadcastPublicMapUpdate: (report: ReturnType<typeof supabaseRowToReport>) => void;
  notifyCommandWebhook: (event: string, data: unknown) => Promise<void>;
  sanitizeAttachments: (raw: unknown) => MediaAttachment[];
  safeCompareSecret: (input: string, expected: string) => boolean;
}

const VALID_REPORT_STATUSES: ReportStatus[] = [
  'Nouvelle',
  'En vérification',
  'Confirmée',
  'Affectée à une équipe',
  'Intervention en cours',
  'Résolue',
  'Clôturée',
];

const VALID_COMPLAINT_STATUSES: ComplaintStatus[] = [
  'Reçue',
  "En cours d'enquête",
  'Transmise au parquet',
  'Clôturée',
];

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 24);
}

function phoneToSyntheticEmail(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits || Date.now()}@citoyen.pnc-alerte.cd`;
}

function formatTimestampFr(date = new Date()): string {
  return `${date.toLocaleDateString('fr-FR')} - ${date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

async function ensureCitizenProfile(
  client: SupabaseClient,
  identity: VerifiedSupabaseIdentity
) {
  const { data: existing } = await client
    .from('pnc_citizens')
    .select('*')
    .eq('uid', identity.uid)
    .maybeSingle();

  if (existing) {
    return supabaseRowToCitizen(existing as Record<string, unknown>);
  }

  const meta = identity.userMetadata || {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    identity.email.split('@')[0] ||
    'Citoyen PNC';
  const phone =
    (typeof meta.phone === 'string' && meta.phone.trim()) || identity.phone || '';
  const commune =
    (typeof meta.commune === 'string' && meta.commune.trim()) || 'Kinshasa';

  const { data: inserted, error } = await client
    .from('pnc_citizens')
    .upsert(
      {
        uid: identity.uid,
        full_name: fullName.slice(0, 80),
        phone: normalizePhone(phone),
        email: identity.email,
        commune: commune.slice(0, 80),
        default_anonymous: false,
        active: true,
      },
      { onConflict: 'uid' }
    )
    .select('*')
    .single();

  if (error || !inserted) {
    return {
      id: identity.uid,
      fullName: fullName.slice(0, 80),
      phone: normalizePhone(phone),
      email: identity.email,
      commune: commune.slice(0, 80),
      defaultAnonymous: false,
      active: true,
      createdAt: new Date().toISOString(),
    };
  }

  return supabaseRowToCitizen(inserted as Record<string, unknown>);
}

async function createSupabaseNotification(
  client: SupabaseClient,
  hooks: SupabaseRouterHooks,
  userUid: string,
  title: string,
  body: string,
  targetScreen?: string
) {
  const now = new Date().toISOString();
  const id = `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const { data } = await client
    .from('pnc_notifications')
    .insert({
      id,
      user_uid: userUid,
      title,
      body,
      created_at: now,
      read: false,
      target_screen: targetScreen || null,
    })
    .select('*')
    .maybeSingle();

  if (data) {
    hooks.broadcastToCommandAndUser(
      userUid,
      'notification:created',
      supabaseRowToNotification(data as Record<string, unknown>)
    );
  }
}

export function createSupabaseRouter(hooks: SupabaseRouterHooks) {
  const router = express.Router();

  async function requireCitizenAuth(
    req: CitizenAuthRequest,
    res: Response,
    next: NextFunction
  ) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentification Supabase requise.' });
      return;
    }
    const token = header.slice('Bearer '.length).trim();
    const verified = await verifySupabaseToken(token);
    if (!verified) {
      res.status(401).json({ error: 'Session Supabase expirée ou invalide.' });
      return;
    }
    const client = getUserScopedSupabaseClient(token);
    if (!client) {
      res.status(503).json({ error: 'Supabase non configuré.' });
      return;
    }
    req.sbUser = verified;
    req.sbToken = token;
    req.sbClient = client;
    next();
  }

  async function optionalCitizenAuth(
    req: CitizenAuthRequest
  ): Promise<{ user: VerifiedSupabaseIdentity; token: string; client: SupabaseClient } | null> {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    const verified = await verifySupabaseToken(token);
    if (!verified) return null;
    const client = getUserScopedSupabaseClient(token);
    if (!client) return null;
    return { user: verified, token, client };
  }

  async function requireCommandAuth(
    req: CommandAuthRequest,
    res: Response,
    next: NextFunction
  ) {
    const expectedKey = process.env.PNC_COMMAND_API_KEY?.trim();
    const headerKey =
      typeof req.headers['x-pnc-command-key'] === 'string'
        ? req.headers['x-pnc-command-key'].trim()
        : '';
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice('Bearer '.length).trim()
      : '';

    // 1. Shared API Key path (legacy/service bridge)
    if (expectedKey && ((headerKey && hooks.safeCompareSecret(headerKey, expectedKey)) || (bearer && hooks.safeCompareSecret(bearer, expectedKey)))) {
      const svc = getServiceSupabaseClient() || getAnonSupabaseClient();
      if (!svc) {
        res.status(503).json({ error: 'Client Supabase indisponible.' });
        return;
      }
      req.commandClient = svc;
      next();
      return;
    }

    // 2. Supabase Operator JWT path (matches Admin Web Command Center)
    if (bearer) {
      const verified = await verifySupabaseToken(bearer);
      if (verified) {
        const op = await isActiveSupabaseOperator(verified.uid, bearer);
        if (op.ok) {
          req.commandOperator = {
            uid: verified.uid,
            displayName: op.displayName,
            role: op.role,
          };
          req.commandClient =
            getServiceSupabaseClient() || getUserScopedSupabaseClient(bearer) || undefined;
          next();
          return;
        }
        res.status(403).json({ error: 'Accès réservé aux opérateurs PNC actifs.' });
        return;
      }
    }

    res.status(401).json({ error: 'Jeton Supabase opérateur ou clé Commandement invalide.' });
  }

  /* ---------------------------- Citizen Auth ------------------------------ */
  router.post('/auth/register', async (req, res) => {
    const { fullName, phone, email, commune, password } = req.body ?? {};
    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof phone !== 'string' ||
      phone.replace(/\D/g, '').length < 8 ||
      typeof password !== 'string' ||
      password.length < 6
    ) {
      res.status(400).json({
        error:
          'Nom complet, numéro de téléphone valide (8 chiffres min.) et mot de passe (6 caractères min.) requis.',
      });
      return;
    }

    const anon = getAnonSupabaseClient();
    if (!anon) {
      res.status(503).json({ error: 'Supabase non configuré.' });
      return;
    }

    const cleanPhone = normalizePhone(phone);
    const cleanName = fullName.trim().slice(0, 80);
    const cleanCommune =
      typeof commune === 'string' && commune.trim() ? commune.trim().slice(0, 80) : 'Kinshasa';
    const cleanEmail =
      typeof email === 'string' && email.trim()
        ? email.trim().slice(0, 120)
        : phoneToSyntheticEmail(cleanPhone);

    const { data, error } = await anon.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          phone: cleanPhone,
          commune: cleanCommune,
        },
      },
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (!data.user) {
      res.status(400).json({ error: "Impossible de créer le compte citoyen." });
      return;
    }

    const token = data.session?.access_token || '';
    const dbClient = getServiceSupabaseClient() || getUserScopedSupabaseClient(token) || anon;

    if (token || getServiceSupabaseClient()) {
      await dbClient.from('pnc_citizens').upsert(
        {
          uid: data.user.id,
          full_name: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          commune: cleanCommune,
          default_anonymous: false,
          active: true,
        },
        { onConflict: 'uid' }
      );
    }

    if (!data.session) {
      res.status(201).json({
        token: '',
        requiresEmailConfirmation: true,
        message: 'Compte créé. Veuillez confirmer votre adresse e-mail puis vous connecter.',
        user: {
          id: data.user.id,
          fullName: cleanName,
          phone: cleanPhone,
          email: cleanEmail,
          commune: cleanCommune,
          defaultAnonymous: false,
          active: true,
          createdAt: data.user.created_at,
        },
      });
      return;
    }

    res.status(201).json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        fullName: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        commune: cleanCommune,
        defaultAnonymous: false,
        active: true,
        createdAt: data.user.created_at,
      },
    });
  });

  router.post('/auth/login', async (req, res) => {
    const { phone, email, password } = req.body ?? {};
    const identifier =
      typeof email === 'string' && email.trim()
        ? email.trim()
        : typeof phone === 'string'
          ? phone.trim()
          : '';

    if (!identifier || typeof password !== 'string' || !password) {
      res.status(400).json({ error: 'E-mail ou téléphone et mot de passe requis.' });
      return;
    }

    const anon = getAnonSupabaseClient();
    if (!anon) {
      res.status(503).json({ error: 'Supabase non configuré.' });
      return;
    }

    let loginEmail = identifier;
    if (!identifier.includes('@')) {
      const cleanPhone = normalizePhone(identifier);
      const svc = getServiceSupabaseClient();
      if (svc) {
        const { data: citizenRow } = await svc
          .from('pnc_citizens')
          .select('email')
          .eq('phone', cleanPhone)
          .maybeSingle();
        if (citizenRow?.email && typeof citizenRow.email === 'string') {
          loginEmail = citizenRow.email;
        } else {
          loginEmail = phoneToSyntheticEmail(cleanPhone);
        }
      } else {
        loginEmail = phoneToSyntheticEmail(cleanPhone);
      }
    }

    const { data, error } = await anon.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error || !data.session || !data.user) {
      res.status(401).json({ error: 'Identifiants incorrects ou compte non confirmé.' });
      return;
    }

    const userClient = getUserScopedSupabaseClient(data.session.access_token)!;
    const profile = await ensureCitizenProfile(userClient, {
      uid: data.user.id,
      email: data.user.email || loginEmail,
      phone: data.user.phone || '',
      userMetadata: (data.user.user_metadata as Record<string, unknown>) || {},
    });

    res.json({
      token: data.session.access_token,
      user: profile,
    });
  });

  /* --------------------------- Public Endpoints --------------------------- */
  router.get('/public/feed', async (req: CitizenAuthRequest, res) => {
    const caller = await optionalCitizenAuth(req);
    const db = caller?.client || getServiceSupabaseClient() || getAnonSupabaseClient();
    if (!db) {
      res.json({ officialAlerts: [], stations: [], mapIncidents: [] });
      return;
    }

    const [alertsRes, facilitiesRes] = await Promise.all([
      db.from('pnc_official_alerts').select('*').order('created_at', { ascending: false }).limit(100),
      db
        .from('pnc_facilities')
        .select('*')
        .eq('category', 'commissariat_police')
        .neq('verification_status', 'desactive')
        .order('name', { ascending: true }),
    ]);

    const favSet = new Set<string>();
    if (caller) {
      const { data: favRows } = await caller.client
        .from('pnc_citizen_station_favorites')
        .select('station_id')
        .eq('user_uid', caller.user.uid);
      if (Array.isArray(favRows)) {
        for (const f of favRows) favSet.add(String(f.station_id));
      }
    }

    // Safe non-PII public map incidents via RPC (or service fallback)
    let mapIncidents: unknown[] = [];
    const { data: rpcIncidents, error: rpcErr } = await db.rpc('get_public_map_incidents');
    if (!rpcErr && Array.isArray(rpcIncidents)) {
      mapIncidents = rpcIncidents.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        reference: String(r.reference),
        category: String(r.type_label || 'Incident'),
        location: String(r.location || 'Kinshasa'),
        latitude: typeof r.latitude === 'number' ? r.latitude : undefined,
        longitude: typeof r.longitude === 'number' ? r.longitude : undefined,
        timestamp: String(r.date_time || ''),
        status: String(r.status_label || 'Intervention en cours'),
        isSos: Boolean(r.is_sos),
      }));
    } else {
      const svc = getServiceSupabaseClient();
      if (svc) {
        const { data: repRows } = await svc
          .from('pnc_reports')
          .select('id, reference, type_label, location, latitude, longitude, date_time, status_label, is_sos')
          .eq('status_key', 'encours')
          .order('created_at', { ascending: false })
          .limit(100);
        if (Array.isArray(repRows)) {
          mapIncidents = repRows.map((r: Record<string, unknown>) => ({
            id: String(r.id),
            reference: String(r.reference),
            category: String(r.type_label || 'Incident'),
            location: String(r.location || 'Kinshasa'),
            latitude: typeof r.latitude === 'number' ? r.latitude : undefined,
            longitude: typeof r.longitude === 'number' ? r.longitude : undefined,
            timestamp: String(r.date_time || ''),
            status: String(r.status_label || 'Intervention en cours'),
            isSos: Boolean(r.is_sos),
          }));
        }
      }
    }

    res.json({
      officialAlerts: Array.isArray(alertsRes.data)
        ? alertsRes.data.map((r) => supabaseRowToAlert(r as Record<string, unknown>))
        : [],
      stations: Array.isArray(facilitiesRes.data)
        ? facilitiesRes.data.map((r) => supabaseFacilityToStation(r as Record<string, unknown>, favSet))
        : [],
      mapIncidents,
    });
  });

  router.get('/documents/verify', async (req, res) => {
    const number = typeof req.query.number === 'string' ? req.query.number.trim().toUpperCase() : '';
    if (!number || number.length < 4) {
      res.status(400).json({ error: 'Numéro de document requis.' });
      return;
    }

    const db = getServiceSupabaseClient() || getAnonSupabaseClient();
    if (!db) {
      res.json({ found: false, query: number });
      return;
    }

    const { data: docRow } = await db
      .from('pnc_verifiable_documents')
      .select('*')
      .ilike('number', number)
      .maybeSingle();

    if (docRow) {
      res.json({
        found: true,
        document: {
          number: String(docRow.number),
          type: String(docRow.type),
          holderName: String(docRow.holder_name),
          issuedBy: String(docRow.issued_by),
          issuedDate: String(docRow.issued_date),
          status: String(docRow.status),
        },
      });
      return;
    }

    const svc = getServiceSupabaseClient();
    if (svc) {
      const { data: compRow } = await svc
        .from('pnc_complaints')
        .select('*')
        .ilike('reference', number)
        .maybeSingle();

      if (compRow) {
        const c = supabaseRowToComplaint(compRow as Record<string, unknown>);
        res.json({
          found: true,
          document: {
            number: c.reference,
            type: `Récépissé de plainte — ${c.type}`,
            holderName: 'Titulaire enregistré',
            issuedBy: c.assignedStation,
            issuedDate: c.date,
            status: c.status === 'Clôturée' ? 'Valide' : 'En cours',
          },
        });
        return;
      }
    }

    res.json({ found: false, query: number });
  });

  /* --------------------------- Citizen Personal API ----------------------- */
  router.get('/citizen/me', requireCitizenAuth, async (req: CitizenAuthRequest, res) => {
    const client = req.sbClient!;
    const identity = req.sbUser!;

    const user = await ensureCitizenProfile(client, identity);

    const [reportsRes, complaintsRes, notifsRes, chatRes] = await Promise.all([
      client
        .from('pnc_reports')
        .select('*')
        .eq('created_by_uid', identity.uid)
        .order('created_at', { ascending: false }),
      client
        .from('pnc_complaints')
        .select('*')
        .eq('created_by_uid', identity.uid)
        .order('created_at', { ascending: false }),
      client
        .from('pnc_notifications')
        .select('*')
        .eq('user_uid', identity.uid)
        .order('created_at', { ascending: false })
        .limit(50),
      client
        .from('pnc_chat_messages')
        .select('*')
        .eq('citizen_uid', identity.uid)
        .order('created_at', { ascending: true })
        .limit(100),
    ]);

    res.json({
      user,
      reports: Array.isArray(reportsRes.data)
        ? reportsRes.data.map((r) => supabaseRowToReport(r as Record<string, unknown>))
        : [],
      complaints: Array.isArray(complaintsRes.data)
        ? complaintsRes.data.map((r) => supabaseRowToComplaint(r as Record<string, unknown>))
        : [],
      notifications: Array.isArray(notifsRes.data)
        ? notifsRes.data.map((r) => supabaseRowToNotification(r as Record<string, unknown>))
        : [],
      chatMessages: Array.isArray(chatRes.data)
        ? chatRes.data.map((r) => supabaseRowToChatMessage(r as Record<string, unknown>))
        : [],
    });
  });

  router.patch('/profile', requireCitizenAuth, async (req: CitizenAuthRequest, res) => {
    const client = req.sbClient!;
    const identity = req.sbUser!;
    const current = await ensureCitizenProfile(client, identity);
    const { fullName, commune, defaultAnonymous, phone } = req.body ?? {};

    const nextName =
      typeof fullName === 'string' && fullName.trim().length >= 2
        ? fullName.trim().slice(0, 80)
        : current.fullName;
    const nextCommune =
      typeof commune === 'string' && commune.trim().length >= 2
        ? commune.trim().slice(0, 80)
        : current.commune;
    const nextAnon =
      typeof defaultAnonymous === 'boolean' ? defaultAnonymous : current.defaultAnonymous;
    const nextPhone =
      typeof phone === 'string' && phone.trim() ? normalizePhone(phone) : current.phone;

    const { data, error } = await client
      .from('pnc_citizens')
      .update({
        full_name: nextName,
        commune: nextCommune,
        default_anonymous: nextAnon,
        phone: nextPhone,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', identity.uid)
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || 'Impossible de mettre à jour le profil.' });
      return;
    }

    res.json({ user: supabaseRowToCitizen(data as Record<string, unknown>) });
  });

  router.post('/stations/:id/favorite', requireCitizenAuth, async (req: CitizenAuthRequest, res) => {
    const client = req.sbClient!;
    const identity = req.sbUser!;
    const stationId = req.params.id;

    const { data: station } = await client
      .from('pnc_facilities')
      .select('id')
      .eq('id', stationId)
      .maybeSingle();

    if (!station) {
      res.status(404).json({ error: 'Commissariat introuvable.' });
      return;
    }

    const { data: existing } = await client
      .from('pnc_citizen_station_favorites')
      .select('station_id')
      .eq('user_uid', identity.uid)
      .eq('station_id', stationId)
      .maybeSingle();

    if (existing) {
      await client
        .from('pnc_citizen_station_favorites')
        .delete()
        .eq('user_uid', identity.uid)
        .eq('station_id', stationId);
      res.json({ stationId, isFavorite: false });
    } else {
      await client
        .from('pnc_citizen_station_favorites')
        .insert({ user_uid: identity.uid, station_id: stationId });
      res.json({ stationId, isFavorite: true });
    }
  });

  router.post('/notifications/read-all', requireCitizenAuth, async (req: CitizenAuthRequest, res) => {
    await req.sbClient!
      .from('pnc_notifications')
      .update({ read: true })
      .eq('user_uid', req.sbUser!.uid);
    res.json({ ok: true });
  });

  router.patch('/notifications/:id/read', requireCitizenAuth, async (req: CitizenAuthRequest, res) => {
    await req.sbClient!
      .from('pnc_notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_uid', req.sbUser!.uid);
    res.json({ ok: true });
  });

  router.post('/reports', async (req: CitizenAuthRequest, res) => {
    const caller = await optionalCitizenAuth(req);
    const {
      category,
      description,
      location,
      latitude,
      longitude,
      attachments,
      anonymous,
      contactName,
      contactPhone,
      isSos,
    } = req.body ?? {};

    if (typeof category !== 'string' || typeof description !== 'string' || !description.trim()) {
      res.status(400).json({ error: 'Catégorie et description requises.' });
      return;
    }

    const db = caller?.client || getServiceSupabaseClient();
    if (!db) {
      res.status(401).json({
        error: 'Veuillez vous connecter (ou configurer SUPABASE_SERVICE_ROLE_KEY côté serveur pour les envois anonymes).',
      });
      return;
    }

    const citizenProfile = caller ? await ensureCitizenProfile(caller.client, caller.user) : null;
    const isAnon = Boolean(anonymous);
    const sosFlag = Boolean(isSos);
    const now = new Date();
    const createdAt = now.toISOString();
    const shortSeq = String(Date.now()).slice(-6);
    const reference = `${sosFlag ? 'SOS' : 'PNC'}-${now.getFullYear()}-${shortSeq}`;
    const id = `rep-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;

    const cleanAttachments = hooks.sanitizeAttachments(attachments);
    const cleanLocation =
      typeof location === 'string' && location.trim()
        ? location.trim().slice(0, 140)
        : citizenProfile?.commune || 'Position non précisée';
    const cleanLat = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null;
    const cleanLng = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null;
    const gpsString =
      cleanLat !== null && cleanLng !== null
        ? `${cleanLat.toFixed(6)}, ${cleanLng.toFixed(6)}`
        : '';

    const reporterName = isAnon
      ? 'Anonyme'
      : (typeof contactName === 'string' && contactName.trim()
          ? contactName.trim().slice(0, 80)
          : citizenProfile?.fullName) || 'Citoyen';
    const reporterPhone = isAnon
      ? ''
      : (typeof contactPhone === 'string' && contactPhone.trim()
          ? contactPhone.trim().slice(0, 30)
          : citizenProfile?.phone) || '';

    const timestamp = formatTimestampFr(now);

    const { data, error } = await db
      .from('pnc_reports')
      .insert({
        id,
        reference,
        type_label: category.trim().slice(0, 60),
        is_sos: sosFlag,
        commune: citizenProfile?.commune || 'Kinshasa',
        province_code: 'CD10',
        location: cleanLocation,
        date_time: timestamp,
        status_key: 'attente',
        status_label: 'Nouvelle',
        priority: sosFlag ? 'Critique' : 'Normale',
        reporter: reporterName,
        gps: gpsString,
        nearest_station: '',
        description: description.trim().slice(0, 1000),
        assigned_unit: '',
        eta: '',
        anonymous: isAnon,
        reporter_phone: reporterPhone,
        latitude: cleanLat,
        longitude: cleanLng,
        attachments_json: cleanAttachments,
        created_by_uid: caller?.user.uid || null,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || "Erreur lors de l'enregistrement du signalement." });
      return;
    }

    const created = supabaseRowToReport(data as Record<string, unknown>);

    if (caller) {
      await createSupabaseNotification(
        caller.client,
        hooks,
        caller.user.uid,
        sosFlag ? 'Alerte SOS transmise' : 'Signalement transmis',
        `Votre dossier ${created.reference} a été transmis au Centre de Commandement PNC (statut : Nouvelle).`,
        'live-tracking'
      );
    }

    hooks.broadcastToCommandAndUser(caller?.user.uid, 'report:created', created);
    void hooks.notifyCommandWebhook('report:created', created);

    res.status(201).json(created);
  });

  router.post('/complaints', requireCitizenAuth, async (req: CitizenAuthRequest, res) => {
    const caller = req.sbUser!;
    const client = req.sbClient!;
    const profile = await ensureCitizenProfile(client, caller);
    const { type, location, description, attachments } = req.body ?? {};

    if (
      typeof type !== 'string' ||
      !type.trim() ||
      typeof location !== 'string' ||
      !location.trim() ||
      typeof description !== 'string' ||
      !description.trim()
    ) {
      res.status(400).json({ error: 'Type, lieu et description requis.' });
      return;
    }

    const now = new Date();
    const createdAt = now.toISOString();
    const shortSeq = String(Date.now()).slice(-6);
    const reference = `PL-${now.getFullYear()}-${shortSeq}`;
    const id = `pl-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const cleanAttachments = Array.isArray(attachments)
      ? attachments.slice(0, 6).map((a) => String(a).trim().slice(0, 120))
      : [];

    const cleanType = type.trim().slice(0, 80);
    const cleanLocation = location.trim().slice(0, 140);
    const cleanDescription = description.trim().slice(0, 1500);
    const dateStr = now.toLocaleDateString('fr-FR');

    const { data, error } = await client
      .from('pnc_complaints')
      .insert({
        id,
        reference,
        citizen: profile.fullName || 'Citoyen',
        subject: `${cleanType} — ${cleanLocation}`,
        status: 'instruction',
        type: cleanType,
        location: cleanLocation,
        description: cleanDescription,
        date: dateStr,
        status_label: 'Reçue',
        attachments_json: cleanAttachments,
        assigned_station: 'En attente d’affectation (Centre de Commandement)',
        citizen_phone: profile.phone,
        created_by_uid: caller.uid,
        created_at: createdAt,
        updated_at: createdAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || 'Erreur lors du dépôt de plainte.' });
      return;
    }

    const created = supabaseRowToComplaint(data as Record<string, unknown>);

    await createSupabaseNotification(
      client,
      hooks,
      caller.uid,
      'Plainte enregistrée',
      `Votre plainte ${created.reference} a été transmise au Centre de Commandement PNC.`,
      'complaints-history'
    );

    hooks.broadcastToCommandAndUser(caller.uid, 'complaint:created', created);
    void hooks.notifyCommandWebhook('complaint:created', created);

    res.status(201).json(created);
  });

  router.post('/chat', requireCitizenAuth, async (req: CitizenAuthRequest, res) => {
    const caller = req.sbUser!;
    const client = req.sbClient!;
    const profile = await ensureCitizenProfile(client, caller);
    const { text, reportId } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Message vide.' });
      return;
    }

    const now = new Date();
    const id = `msg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const createdAt = now.toISOString();
    const cleanReportId = typeof reportId === 'string' && reportId.trim() ? reportId.trim() : null;

    const { data, error } = await client
      .from('pnc_chat_messages')
      .insert({
        id,
        report_id: cleanReportId,
        citizen_uid: caller.uid,
        sender: 'user',
        sender_name: profile.fullName || 'Citoyen',
        text: text.trim().slice(0, 800),
        time,
        created_at: createdAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || "Erreur d'envoi du message." });
      return;
    }

    const msg = supabaseRowToChatMessage(data as Record<string, unknown>);
    hooks.broadcastToCommandAndUser(caller.uid, 'chat:message', msg);
    void hooks.notifyCommandWebhook('chat:message', msg);

    res.status(201).json(msg);
  });

  /* ============== Command Center Bridge API (Supabase-backed) ============= */
  router.get('/command/health', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const [u, r, c, s, a] = await Promise.all([
      db.from('pnc_citizens').select('*', { count: 'exact', head: true }),
      db.from('pnc_reports').select('*', { count: 'exact', head: true }),
      db.from('pnc_complaints').select('*', { count: 'exact', head: true }),
      db
        .from('pnc_facilities')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'commissariat_police'),
      db.from('pnc_official_alerts').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      status: 'ok',
      backend: 'supabase',
      service: 'pnc-alerte-citizen-backend',
      timestamp: new Date().toISOString(),
      counts: {
        users: u.count || 0,
        reports: r.count || 0,
        complaints: c.count || 0,
        stations: s.count || 0,
        officialAlerts: a.count || 0,
      },
    });
  });

  router.get('/command/sync', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const since =
      typeof req.query.since === 'string' && req.query.since.trim() ? req.query.since.trim() : null;

    let repQuery = db.from('pnc_reports').select('*').order('created_at', { ascending: false });
    let compQuery = db.from('pnc_complaints').select('*').order('created_at', { ascending: false });
    let chatQuery = db.from('pnc_chat_messages').select('*').order('created_at', { ascending: true });

    if (since) {
      repQuery = repQuery.gte('created_at', since);
      compQuery = compQuery.gte('created_at', since);
      chatQuery = chatQuery.gte('created_at', since);
    }

    const [repRes, compRes, stRes, alRes, chatRes, citRes] = await Promise.all([
      repQuery,
      compQuery,
      db
        .from('pnc_facilities')
        .select('*')
        .eq('category', 'commissariat_police')
        .order('name', { ascending: true }),
      db.from('pnc_official_alerts').select('*').order('created_at', { ascending: false }),
      chatQuery,
      db.from('pnc_citizens').select('*', { count: 'exact', head: true }),
    ]);

    res.json({
      syncedAt: new Date().toISOString(),
      citizensCount: citRes.count || 0,
      reports: (repRes.data || []).map((r) => supabaseRowToReport(r as Record<string, unknown>)),
      complaints: (compRes.data || []).map((r) => supabaseRowToComplaint(r as Record<string, unknown>)),
      stations: (stRes.data || []).map((r) => supabaseFacilityToStation(r as Record<string, unknown>)),
      officialAlerts: (alRes.data || []).map((r) => supabaseRowToAlert(r as Record<string, unknown>)),
      chatMessages: (chatRes.data || []).map((r) =>
        supabaseRowToChatMessage(r as Record<string, unknown>)
      ),
    });
  });

  router.get('/command/reports', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const { data, error } = await req.commandClient!
      .from('pnc_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json((data || []).map((r) => supabaseRowToReport(r as Record<string, unknown>)));
  });

  router.patch('/command/reports/:id/status', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const { data: existingRow } = await db
      .from('pnc_reports')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (!existingRow) {
      res.status(404).json({ error: 'Signalement introuvable.' });
      return;
    }

    const report = supabaseRowToReport(existingRow as Record<string, unknown>);
    const { status, patrolUnit, assignedStationId, etaMinutes, validatedBy, validationNotes } =
      req.body ?? {};

    if (typeof status !== 'string' || !VALID_REPORT_STATUSES.includes(status as ReportStatus)) {
      res.status(400).json({ error: 'Statut de signalement invalide.' });
      return;
    }

    const nextStatus = status as ReportStatus;
    if (nextStatus === 'Affectée à une équipe') {
      if (report.status === 'Nouvelle') {
        res.status(400).json({
          error:
            "Validation préalable requise : examinez et confirmez l'alerte avant d'affecter une équipe.",
        });
        return;
      }
      if (typeof patrolUnit !== 'string' || !patrolUnit.trim()) {
        res.status(400).json({ error: "Veuillez désigner une unité d'intervention." });
        return;
      }
    }

    const nextKey = mapCitizenStatusToAdminKey(nextStatus);
    const nextPatrolUnit =
      typeof patrolUnit === 'string' && patrolUnit.trim()
        ? patrolUnit.trim().slice(0, 80)
        : report.patrolUnit || '';
    const nextStationId =
      typeof assignedStationId === 'string' && assignedStationId.trim()
        ? assignedStationId.trim().slice(0, 60)
        : report.assignedStationId || '';
    const nextEta =
      typeof etaMinutes === 'number' && Number.isFinite(etaMinutes) && etaMinutes > 0
        ? Math.round(etaMinutes)
        : report.etaMinutes ?? null;
    const nextValidatedBy =
      typeof validatedBy === 'string' && validatedBy.trim()
        ? validatedBy.trim().slice(0, 80)
        : report.validatedBy || '';
    const nextNotes =
      typeof validationNotes === 'string' && validationNotes.trim()
        ? validationNotes.trim().slice(0, 400)
        : report.validationNotes || '';

    const { data: updatedRow, error } = await db
      .from('pnc_reports')
      .update({
        status_key: nextKey,
        status_label: nextStatus,
        assigned_unit: nextPatrolUnit,
        assigned_station_id: nextStationId,
        nearest_station: nextStationId,
        eta_minutes: nextEta,
        eta: nextEta ? `${nextEta} min` : '',
        validated_by: nextValidatedBy,
        validation_notes: nextNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)
      .select('*')
      .single();

    if (error || !updatedRow) {
      res.status(400).json({ error: error?.message || 'Mise à jour impossible.' });
      return;
    }

    const updated = supabaseRowToReport(updatedRow as Record<string, unknown>);
    if (updated.reporterId) {
      await createSupabaseNotification(
        db,
        hooks,
        updated.reporterId,
        `Signalement ${updated.reference}`,
        `Statut mis à jour : ${updated.status}${updated.patrolUnit ? ` (${updated.patrolUnit})` : ''}.`,
        'live-tracking'
      );
    }

    hooks.broadcastToCommandAndUser(updated.reporterId, 'report:updated', updated);
    hooks.broadcastPublicMapUpdate(updated);
    res.json(updated);
  });

  router.get('/command/complaints', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const { data, error } = await req.commandClient!
      .from('pnc_complaints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json((data || []).map((r) => supabaseRowToComplaint(r as Record<string, unknown>)));
  });

  router.patch('/command/complaints/:id', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const { data: row } = await db
      .from('pnc_complaints')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    if (!row) {
      res.status(404).json({ error: 'Plainte introuvable.' });
      return;
    }

    const existing = supabaseRowToComplaint(row as Record<string, unknown>);
    const { status, assignedStation } = req.body ?? {};
    const nextStatus =
      typeof status === 'string' && VALID_COMPLAINT_STATUSES.includes(status as ComplaintStatus)
        ? (status as ComplaintStatus)
        : existing.status;
    const nextStation =
      typeof assignedStation === 'string' && assignedStation.trim()
        ? assignedStation.trim().slice(0, 80)
        : existing.assignedStation;

    const { data: updatedRow, error } = await db
      .from('pnc_complaints')
      .update({
        status: nextStatus === 'Clôturée' ? 'traitee' : 'instruction',
        status_label: nextStatus,
        assigned_station: nextStation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error || !updatedRow) {
      res.status(400).json({ error: error?.message || 'Mise à jour impossible.' });
      return;
    }

    const updated = supabaseRowToComplaint(updatedRow as Record<string, unknown>);
    if (updated.citizenId) {
      await createSupabaseNotification(
        db,
        hooks,
        updated.citizenId,
        `Plainte ${updated.reference}`,
        `Statut actualisé : ${updated.status} · ${updated.assignedStation}.`,
        'complaints-history'
      );
    }

    hooks.broadcastToCommandAndUser(updated.citizenId, 'complaint:updated', updated);
    res.json(updated);
  });

  router.post('/command/alerts', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const { title, category, summary, fullDetails, location, priority, publishedBy } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || typeof summary !== 'string' || !summary.trim()) {
      res.status(400).json({ error: 'Titre et résumé requis.' });
      return;
    }
    const adminCat: 'Sécurité' | 'Avis' | 'Info' =
      category === 'securite' || category === 'Sécurité'
        ? 'Sécurité'
        : category === 'avis' || category === 'Avis'
          ? 'Avis'
          : 'Info';

    const id = `oa-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const prio = priority === 'high' || priority === 'medium' ? priority : 'normal';
    const createdByUid = req.commandOperator?.uid;
    if (!createdByUid) {
      res.status(400).json({ error: 'UID opérateur Supabase requis pour publier une alerte.' });
      return;
    }

    const { data, error } = await db
      .from('pnc_official_alerts')
      .insert({
        id,
        category: adminCat,
        title: title.trim().slice(0, 80),
        message: summary.trim().slice(0, 160),
        full_details:
          typeof fullDetails === 'string' && fullDetails.trim()
            ? fullDetails.trim().slice(0, 1000)
            : summary.trim().slice(0, 160),
        location:
          typeof location === 'string' && location.trim() ? location.trim().slice(0, 100) : 'Kinshasa',
        priority: prio,
        published_at: new Date().toLocaleString('fr-FR'),
        published_by:
          typeof publishedBy === 'string' && publishedBy.trim()
            ? publishedBy.trim().slice(0, 80)
            : req.commandOperator?.displayName || 'Centre de Commandement PNC',
        created_by_uid: createdByUid,
        created_at: createdAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || "Impossible de publier l'alerte." });
      return;
    }

    const created = supabaseRowToAlert(data as Record<string, unknown>);
    hooks.broadcastAll('alert:created', created);
    res.status(201).json(created);
  });

  router.delete('/command/alerts/:id', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const { error } = await req.commandClient!
      .from('pnc_official_alerts')
      .delete()
      .eq('id', req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    hooks.broadcastAll('alert:deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  router.post('/command/stations', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const {
      id,
      name,
      address,
      commune,
      phone,
      hours,
      latitude,
      longitude,
      operationalStatus,
      activeUnits,
    } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || typeof commune !== 'string' || !commune.trim()) {
      res.status(400).json({ error: 'Nom et commune du commissariat requis.' });
      return;
    }
    const createdByUid = req.commandOperator?.uid;
    if (!createdByUid) {
      res.status(400).json({ error: 'UID opérateur Supabase requis.' });
      return;
    }

    const stationId =
      typeof id === 'string' && id.trim()
        ? id.trim().slice(0, 60)
        : `st-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;

    const lat = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : -4.325;
    const lng = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : 15.322;

    const { error } = await db.from('pnc_facilities').upsert(
      {
        id: stationId,
        name: name.trim().slice(0, 80),
        category: 'commissariat_police',
        province_code: 'CD10',
        province_name: 'Kinshasa',
        commune_or_sector: commune.trim().slice(0, 60),
        address:
          typeof address === 'string' && address.trim()
            ? address.trim().slice(0, 140)
            : commune.trim(),
        latitude: lat,
        longitude: lng,
        source_code: 'pnc_command',
        origin_type: 'officiel_pnc',
        is_official_pnc: true,
        verification_status: 'verifie',
        phone_number: typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 30) : '112',
        hours: typeof hours === 'string' && hours.trim() ? hours.trim().slice(0, 80) : 'Ouvert 24h/24',
        operational_status:
          operationalStatus === 'Alerte renforcée' || operationalStatus === 'Maintenance'
            ? operationalStatus
            : 'Opérationnel',
        active_units:
          typeof activeUnits === 'number' && Number.isFinite(activeUnits) && activeUnits >= 0
            ? Math.round(activeUnits)
            : 0,
        created_by_uid: createdByUid,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const { data: allRows } = await db
      .from('pnc_facilities')
      .select('*')
      .eq('category', 'commissariat_police')
      .neq('verification_status', 'desactive')
      .order('name', { ascending: true });

    const allStations = (allRows || []).map((r) =>
      supabaseFacilityToStation(r as Record<string, unknown>)
    );
    hooks.broadcastAll('station:updated', allStations);
    res.status(201).json(allStations.find((s) => s.id === stationId));
  });

  router.delete('/command/stations/:id', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const { error } = await db.from('pnc_facilities').delete().eq('id', req.params.id);
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    const { data: allRows } = await db
      .from('pnc_facilities')
      .select('*')
      .eq('category', 'commissariat_police')
      .neq('verification_status', 'desactive')
      .order('name', { ascending: true });

    const allStations = (allRows || []).map((r) =>
      supabaseFacilityToStation(r as Record<string, unknown>)
    );
    hooks.broadcastAll('station:updated', allStations);
    res.json({ ok: true });
  });

  router.post('/command/documents', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const { number, type, holderName, issuedBy, issuedDate, status } = req.body ?? {};
    if (
      typeof number !== 'string' ||
      !number.trim() ||
      typeof type !== 'string' ||
      !type.trim() ||
      typeof holderName !== 'string' ||
      !holderName.trim()
    ) {
      res.status(400).json({ error: 'Numéro, type et titulaire du document requis.' });
      return;
    }

    const docStatus = status === 'En cours' || status === 'Expiré' ? status : 'Valide';
    const cleanNum = number.trim().toUpperCase().slice(0, 60);

    const { error } = await req.commandClient!.from('pnc_verifiable_documents').upsert(
      {
        number: cleanNum,
        type: type.trim().slice(0, 80),
        holder_name: holderName.trim().slice(0, 80),
        issued_by: typeof issuedBy === 'string' && issuedBy.trim() ? issuedBy.trim().slice(0, 80) : 'PNC',
        issued_date:
          typeof issuedDate === 'string' && issuedDate.trim()
            ? issuedDate.trim().slice(0, 30)
            : new Date().toLocaleDateString('fr-FR'),
        status: docStatus,
      },
      { onConflict: 'number' }
    );

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(201).json({ number: cleanNum, status: docStatus });
  });

  router.post('/command/chat', requireCommandAuth, async (req: CommandAuthRequest, res) => {
    const db = req.commandClient!;
    const { citizenId, reportId, text, senderName } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Message vide.' });
      return;
    }

    let resolvedCitizenUid =
      typeof citizenId === 'string' && citizenId.trim() ? citizenId.trim() : undefined;
    if (!resolvedCitizenUid && typeof reportId === 'string' && reportId.trim()) {
      const { data: repRow } = await db
        .from('pnc_reports')
        .select('created_by_uid')
        .eq('id', reportId.trim())
        .maybeSingle();
      if (repRow?.created_by_uid) resolvedCitizenUid = String(repRow.created_by_uid);
    }

    const now = new Date();
    const id = `msg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const createdAt = now.toISOString();
    const cleanSender =
      typeof senderName === 'string' && senderName.trim()
        ? senderName.trim().slice(0, 80)
        : req.commandOperator?.displayName || 'Salle de Commandement PNC';

    const { data, error } = await db
      .from('pnc_chat_messages')
      .insert({
        id,
        report_id: typeof reportId === 'string' && reportId.trim() ? reportId.trim() : null,
        citizen_uid: resolvedCitizenUid || null,
        sender: 'dispatch',
        sender_name: cleanSender,
        text: text.trim().slice(0, 800),
        time,
        created_at: createdAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      res.status(400).json({ error: error?.message || "Impossible d'envoyer le message." });
      return;
    }

    const msg = supabaseRowToChatMessage(data as Record<string, unknown>);
    if (resolvedCitizenUid) {
      await createSupabaseNotification(
        db,
        hooks,
        resolvedCitizenUid,
        'Message du Centre PNC',
        msg.text.slice(0, 120),
        'dispatch-chat'
      );
    }

    hooks.broadcastToCommandAndUser(resolvedCitizenUid, 'chat:message', msg);
    res.status(201).json(msg);
  });

  return router;
}
