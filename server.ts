import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import {
  getSupabaseEnvConfig,
  isActiveSupabaseOperator,
  verifySupabaseToken,
} from './server/supabaseBridge.ts';
import { createSupabaseRouter } from './server/supabaseRouter.ts';

type ReportStatus =
  | 'Nouvelle'
  | 'En vérification'
  | 'Confirmée'
  | 'Affectée à une équipe'
  | 'Intervention en cours'
  | 'Résolue'
  | 'Clôturée';

type ComplaintStatus =
  | 'Reçue'
  | "En cours d'enquête"
  | 'Transmise au parquet'
  | 'Clôturée';

interface StoredUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  commune: string;
  defaultAnonymous: boolean;
  active: boolean;
  createdAt: string;
}

interface MediaAttachment {
  id: string;
  type: 'photo' | 'video' | 'audio';
  name: string;
  sizeOrDuration: string;
  dataUrl?: string;
}

interface StoredReport {
  id: string;
  reference: string;
  category: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  createdAt: string;
  status: ReportStatus;
  filterKey: 'encours' | 'cloturee';
  anonymous: boolean;
  reporterId?: string;
  reporterName?: string;
  reporterPhone?: string;
  attachments: MediaAttachment[];
  etaMinutes?: number;
  patrolUnit?: string;
  assignedStationId?: string;
  validatedBy?: string;
  validationNotes?: string;
  isSos: boolean;
}

interface PublicMapIncident {
  id: string;
  reference: string;
  category: string;
  location: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  status: ReportStatus;
  isSos: boolean;
}

interface StoredComplaint {
  id: string;
  reference: string;
  type: string;
  location: string;
  description: string;
  date: string;
  createdAt: string;
  status: ComplaintStatus;
  attachments: string[];
  assignedStation: string;
  citizenId: string;
  citizenName: string;
  citizenPhone: string;
}

interface StoredStation {
  id: string;
  name: string;
  address: string;
  commune: string;
  phone: string;
  hours: string;
  isFavorite?: boolean;
  latitude?: number;
  longitude?: number;
  operationalStatus: 'Opérationnel' | 'Alerte renforcée' | 'Maintenance';
  activeUnits: number;
  updatedAt: string;
}

interface StoredAlert {
  id: string;
  title: string;
  category: 'securite' | 'avis' | 'info';
  categoryLabel: string;
  summary: string;
  fullDetails: string;
  location: string;
  timeAgo: string;
  createdAt: string;
  icon: string;
  priority: 'high' | 'medium' | 'normal';
  publishedBy: string;
}

interface StoredChatMessage {
  id: string;
  reportId?: string;
  citizenId?: string;
  sender: 'user' | 'dispatch';
  senderName: string;
  text: string;
  time: string;
  createdAt: string;
}

interface StoredNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  time: string;
  createdAt: string;
  read: boolean;
  targetScreen?: string;
}

interface AuthenticatedRequest extends Request {
  authUser?: StoredUser;
}

type WsIdentity =
  | { kind: 'anonymous' }
  | { kind: 'citizen'; userId: string }
  | { kind: 'command' };

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'pnc-alerte.sqlite');

if (!DB_PATH.startsWith(DATA_DIR + path.sep)) {
  throw new Error('Invalid database path confinement');
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const sqlite = new DatabaseSync(DB_PATH);
sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    commune TEXT NOT NULL,
    default_anonymous INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    timestamp TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    filter_key TEXT NOT NULL,
    anonymous INTEGER NOT NULL DEFAULT 0,
    reporter_id TEXT,
    reporter_name TEXT,
    reporter_phone TEXT,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    eta_minutes INTEGER,
    patrol_unit TEXT,
    assigned_station_id TEXT,
    validated_by TEXT,
    validation_notes TEXT,
    is_sos INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    reference TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    assigned_station TEXT NOT NULL,
    citizen_id TEXT NOT NULL,
    citizen_name TEXT NOT NULL,
    citizen_phone TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    commune TEXT NOT NULL,
    phone TEXT NOT NULL,
    hours TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    operational_status TEXT NOT NULL DEFAULT 'Opérationnel',
    active_units INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_station_favorites (
    user_id TEXT NOT NULL,
    station_id TEXT NOT NULL,
    PRIMARY KEY (user_id, station_id)
  );

  CREATE TABLE IF NOT EXISTS official_alerts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    category_label TEXT NOT NULL,
    summary TEXT NOT NULL,
    full_details TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TEXT NOT NULL,
    icon TEXT NOT NULL,
    priority TEXT NOT NULL,
    published_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verifiable_documents (
    number TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    holder_name TEXT NOT NULL,
    issued_by TEXT NOT NULL,
    issued_date TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    report_id TEXT,
    citizen_id TEXT,
    sender TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    text TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    target_screen TEXT
  );
`);

const VALID_REPORT_STATUSES: ReportStatus[] = [
  'Nouvelle',
  'En vérification',
  'Confirmée',
  'Affectée à une équipe',
  'Intervention en cours',
  'Résolue',
  'Clôturée',
];

const PUBLIC_MAP_STATUSES: ReportStatus[] = [
  'Confirmée',
  'Affectée à une équipe',
  'Intervention en cours',
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

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

function safeCompareSecret(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function signToken(userId: string): string {
  const payloadObj = {
    sub: userId,
    typ: 'citizen',
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return { sub: parsed.sub };
  } catch {
    return null;
  }
}

function formatTimestampFr(date = new Date()): string {
  return `${date.toLocaleDateString('fr-FR')} - ${date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatRelativeTimeFr(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 60_000) return "À l'instant";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

function rowToUser(row: Record<string, unknown>): StoredUser {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    phone: String(row.phone),
    email: String(row.email || ''),
    commune: String(row.commune),
    defaultAnonymous: Boolean(row.default_anonymous),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
  };
}

function rowToReport(row: Record<string, unknown>): StoredReport {
  let attachments: MediaAttachment[] = [];
  try {
    attachments = JSON.parse(String(row.attachments_json || '[]')) as MediaAttachment[];
  } catch {
    attachments = [];
  }
  return {
    id: String(row.id),
    reference: String(row.reference),
    category: String(row.category),
    description: String(row.description),
    location: String(row.location),
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
    timestamp: String(row.timestamp),
    createdAt: String(row.created_at),
    status: row.status as ReportStatus,
    filterKey: row.filter_key as 'encours' | 'cloturee',
    anonymous: Boolean(row.anonymous),
    reporterId: row.reporter_id ? String(row.reporter_id) : undefined,
    reporterName: row.reporter_name ? String(row.reporter_name) : undefined,
    reporterPhone: row.reporter_phone ? String(row.reporter_phone) : undefined,
    attachments,
    etaMinutes: typeof row.eta_minutes === 'number' ? row.eta_minutes : undefined,
    patrolUnit: row.patrol_unit ? String(row.patrol_unit) : undefined,
    assignedStationId: row.assigned_station_id ? String(row.assigned_station_id) : undefined,
    validatedBy: row.validated_by ? String(row.validated_by) : undefined,
    validationNotes: row.validation_notes ? String(row.validation_notes) : undefined,
    isSos: Boolean(row.is_sos),
  };
}

function toPublicMapIncident(report: StoredReport): PublicMapIncident {
  return {
    id: report.id,
    reference: report.reference,
    category: report.category,
    location: report.location,
    latitude: report.latitude,
    longitude: report.longitude,
    timestamp: report.timestamp,
    status: report.status,
    isSos: report.isSos,
  };
}

function rowToComplaint(row: Record<string, unknown>): StoredComplaint {
  let attachments: string[] = [];
  try {
    attachments = JSON.parse(String(row.attachments_json || '[]')) as string[];
  } catch {
    attachments = [];
  }
  return {
    id: String(row.id),
    reference: String(row.reference),
    type: String(row.type),
    location: String(row.location),
    description: String(row.description),
    date: String(row.date),
    createdAt: String(row.created_at),
    status: row.status as ComplaintStatus,
    attachments,
    assignedStation: String(row.assigned_station),
    citizenId: String(row.citizen_id),
    citizenName: String(row.citizen_name),
    citizenPhone: String(row.citizen_phone),
  };
}

function rowToStation(row: Record<string, unknown>, favoriteIds?: Set<string>): StoredStation {
  const id = String(row.id);
  return {
    id,
    name: String(row.name),
    address: String(row.address),
    commune: String(row.commune),
    phone: String(row.phone),
    hours: String(row.hours),
    isFavorite: favoriteIds ? favoriteIds.has(id) : false,
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
    operationalStatus: row.operational_status as StoredStation['operationalStatus'],
    activeUnits: Number(row.active_units || 0),
    updatedAt: String(row.updated_at),
  };
}

function rowToAlert(row: Record<string, unknown>): StoredAlert {
  const createdAt = String(row.created_at);
  return {
    id: String(row.id),
    title: String(row.title),
    category: row.category as StoredAlert['category'],
    categoryLabel: String(row.category_label),
    summary: String(row.summary),
    fullDetails: String(row.full_details),
    location: String(row.location),
    createdAt,
    timeAgo: formatRelativeTimeFr(createdAt),
    icon: String(row.icon),
    priority: row.priority as StoredAlert['priority'],
    publishedBy: String(row.published_by),
  };
}

function rowToChatMessage(row: Record<string, unknown>): StoredChatMessage {
  return {
    id: String(row.id),
    reportId: row.report_id ? String(row.report_id) : undefined,
    citizenId: row.citizen_id ? String(row.citizen_id) : undefined,
    sender: row.sender as 'user' | 'dispatch',
    senderName: String(row.sender_name),
    text: String(row.text),
    time: String(row.time),
    createdAt: String(row.created_at),
  };
}

function rowToNotification(row: Record<string, unknown>): StoredNotification {
  const createdAt = String(row.created_at);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    body: String(row.body),
    createdAt,
    time: formatRelativeTimeFr(createdAt),
    read: Boolean(row.read),
    targetScreen: row.target_screen ? String(row.target_screen) : undefined,
  };
}

function isSafeWebhookUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host.startsWith('169.254.') ||
      host === '::1'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function notifyCommandWebhook(event: string, data: unknown): Promise<void> {
  const rawUrl = process.env.PNC_COMMAND_WEBHOOK_URL?.trim();
  if (!rawUrl) return;
  const target = isSafeWebhookUrl(rawUrl);
  if (!target) return;

  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const apiKey = process.env.PNC_COMMAND_API_KEY?.trim();
  if (apiKey) {
    headers['X-PNC-Command-Key'] = apiKey;
    headers['X-PNC-Signature'] = crypto.createHmac('sha256', apiKey).update(body).digest('hex');
  }

  try {
    await fetch(target.toString(), {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Non-blocking outbound push; Command Center can also pull via /api/command/sync
  }
}

function sanitizeAttachments(raw: unknown): MediaAttachment[] {
  if (!Array.isArray(raw)) return [];
  const clean: MediaAttachment[] = [];
  for (const item of raw.slice(0, 6)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const type = obj.type === 'photo' || obj.type === 'video' || obj.type === 'audio' ? obj.type : null;
    if (!type || typeof obj.name !== 'string') continue;
    let safeDataUrl: string | undefined;
    if (typeof obj.dataUrl === 'string' && obj.dataUrl.length <= 1_200_000) {
      if (
        (type === 'photo' && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(obj.dataUrl)) ||
        (type === 'audio' && /^data:audio\/(webm|ogg|mp4|mpeg|wav);base64,/i.test(obj.dataUrl))
      ) {
        safeDataUrl = obj.dataUrl;
      }
    }
    clean.push({
      id: typeof obj.id === 'string' ? obj.id.slice(0, 40) : `att-${Date.now()}`,
      type,
      name: obj.name.trim().slice(0, 120),
      sizeOrDuration:
        typeof obj.sizeOrDuration === 'string' ? obj.sizeOrDuration.trim().slice(0, 40) : '',
      dataUrl: safeDataUrl,
    });
  }
  return clean;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  /* --------- Supabase Public Config & Citizen Schema Endpoints ----------- */
  app.get('/api/config/supabase', (_req, res) => {
    const cfg = getSupabaseEnvConfig();
    res.json({
      configured: cfg.configured,
      url: cfg.configured ? cfg.url : null,
      anonKey: cfg.configured ? cfg.anonKey : null,
    });
  });

  app.get('/api/schema/supabase', (_req, res) => {
    const dbDir = path.resolve(process.cwd(), 'db');
    const schemaPath = path.resolve(dbDir, 'supabase_citizen_bridge.sql');
    if (!schemaPath.startsWith(dbDir + path.sep) || !fs.existsSync(schemaPath)) {
      res.status(404).type('text/plain').send('-- Schema file not found');
      return;
    }
    res.type('text/plain; charset=utf-8').send(fs.readFileSync(schemaPath, 'utf8'));
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const wsClients = new Map<WebSocket, WsIdentity>();

  function sendWs(client: WebSocket, event: string, payload: unknown) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ event, payload }));
    }
  }

  function broadcastAll(event: string, payload: unknown) {
    wss.clients.forEach((client) => sendWs(client, event, payload));
  }

  function broadcastToCommandAndUser(userId: string | undefined, event: string, payload: unknown) {
    wss.clients.forEach((client) => {
      const id = wsClients.get(client);
      if (!id) return;
      if (id.kind === 'command' || (userId && id.kind === 'citizen' && id.userId === userId)) {
        sendWs(client, event, payload);
      }
    });
  }

  function broadcastPublicMapUpdate(report: {
    id: string;
    reference: string;
    category: string;
    location: string;
    latitude?: number;
    longitude?: number;
    timestamp: string;
    status: ReportStatus;
    isSos: boolean;
  }) {
    if (!PUBLIC_MAP_STATUSES.includes(report.status)) return;
    const pin: PublicMapIncident = {
      id: report.id,
      reference: report.reference,
      category: report.category,
      location: report.location,
      latitude: report.latitude,
      longitude: report.longitude,
      timestamp: report.timestamp,
      status: report.status,
      isSos: report.isSos,
    };
    wss.clients.forEach((client) => {
      const id = wsClients.get(client);
      if (!id || id.kind !== 'command') {
        sendWs(client, 'map:incident', pin);
      }
    });
  }

  wss.on('connection', (ws) => {
    wsClients.set(ws, { kind: 'anonymous' });
    ws.on('message', (raw) => {
      void (async () => {
        try {
          const msg = JSON.parse(String(raw)) as { type?: string; token?: string; apiKey?: string };
          if (msg.type === 'auth' && typeof msg.token === 'string') {
            const tokenStr = msg.token.trim();
            if (getSupabaseEnvConfig().configured) {
              const sbIdentity = await verifySupabaseToken(tokenStr);
              wsClients.set(
                ws,
                sbIdentity ? { kind: 'citizen', userId: sbIdentity.uid } : { kind: 'anonymous' }
              );
            } else {
              const verified = verifyToken(tokenStr);
              if (verified) {
                const row = sqlite
                  .prepare('SELECT id FROM users WHERE id = ? AND active = 1')
                  .get(verified.sub) as { id: string } | undefined;
                wsClients.set(ws, row ? { kind: 'citizen', userId: row.id } : { kind: 'anonymous' });
              } else {
                wsClients.set(ws, { kind: 'anonymous' });
              }
            }
          } else if (msg.type === 'command_auth') {
            const expectedKey = process.env.PNC_COMMAND_API_KEY?.trim();
            if (
              typeof msg.apiKey === 'string' &&
              expectedKey &&
              safeCompareSecret(msg.apiKey.trim(), expectedKey)
            ) {
              wsClients.set(ws, { kind: 'command' });
              sendWs(ws, 'ws:command_authenticated', { ok: true });
            } else if (typeof msg.token === 'string' && getSupabaseEnvConfig().configured) {
              const sbIdentity = await verifySupabaseToken(msg.token.trim());
              if (sbIdentity) {
                const op = await isActiveSupabaseOperator(sbIdentity.uid, msg.token.trim());
                if (op.ok) {
                  wsClients.set(ws, { kind: 'command' });
                  sendWs(ws, 'ws:command_authenticated', { ok: true });
                }
              }
            }
          } else if (msg.type === 'logout') {
            wsClients.set(ws, { kind: 'anonymous' });
          }
        } catch {
          // Ignore malformed frames
        }
      })();
    });
    ws.on('close', () => {
      wsClients.delete(ws);
    });
    sendWs(ws, 'ws:connected', { connectedAt: new Date().toISOString() });
  });

  function requireCitizenAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    const verified = verifyToken(header.slice('Bearer '.length).trim());
    if (!verified) {
      res.status(401).json({ error: 'Session expirée ou invalide.' });
      return;
    }
    const row = sqlite
      .prepare('SELECT * FROM users WHERE id = ? AND active = 1')
      .get(verified.sub) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(403).json({ error: 'Compte introuvable ou désactivé.' });
      return;
    }
    req.authUser = rowToUser(row);
    next();
  }

  function optionalCitizenAuth(req: AuthenticatedRequest): StoredUser | undefined {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return undefined;
    const verified = verifyToken(header.slice('Bearer '.length).trim());
    if (!verified) return undefined;
    const row = sqlite
      .prepare('SELECT * FROM users WHERE id = ? AND active = 1')
      .get(verified.sub) as Record<string, unknown> | undefined;
    return row ? rowToUser(row) : undefined;
  }

  /* -------- Command Center Bridge CORS & API Key Authentication -------- */
  app.use('/api/command', (req, res, next) => {
    const originEnv = process.env.PNC_COMMAND_ORIGIN?.trim() || '';
    const allowedOrigins = originEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const reqOrigin = req.headers.origin;
    if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', reqOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-PNC-Command-Key');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  if (getSupabaseEnvConfig().configured) {
    console.log('[PNC Alerte] Mode Supabase actif (Auth, API & Temps réel partagés).');
    app.use(
      '/api',
      createSupabaseRouter({
        broadcastAll,
        broadcastToCommandAndUser,
        broadcastPublicMapUpdate,
        notifyCommandWebhook,
        sanitizeAttachments,
        safeCompareSecret,
      })
    );
  }

  function requireCommandKey(req: Request, res: Response, next: NextFunction) {
    const expectedKey = process.env.PNC_COMMAND_API_KEY?.trim();
    if (!expectedKey) {
      res.status(503).json({
        error: 'Clé inter-applications PNC_COMMAND_API_KEY non configurée sur le serveur.',
      });
      return;
    }
    const headerKey =
      (typeof req.headers['x-pnc-command-key'] === 'string'
        ? req.headers['x-pnc-command-key'].trim()
        : '') ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice('Bearer '.length).trim()
        : '');
    if (!headerKey || !safeCompareSecret(headerKey, expectedKey)) {
      res.status(401).json({ error: 'Clé d’authentification Centre de Commandement invalide.' });
      return;
    }
    next();
  }

  function createCitizenNotification(
    userId: string,
    title: string,
    body: string,
    targetScreen?: string
  ) {
    const now = new Date().toISOString();
    const id = `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    sqlite
      .prepare(
        'INSERT INTO notifications (id, user_id, title, body, created_at, read, target_screen) VALUES (?, ?, ?, ?, ?, 0, ?)'
      )
      .run(id, userId, title, body, now, targetScreen || null);
    const notif: StoredNotification = {
      id,
      userId,
      title,
      body,
      createdAt: now,
      time: "À l'instant",
      read: false,
      targetScreen,
    };
    broadcastToCommandAndUser(userId, 'notification:created', notif);
  }

  /* ---------------------------- Citizen Auth ------------------------------ */
  app.post('/api/auth/register', (req, res) => {
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

    const cleanPhone = normalizePhone(phone);
    const existing = sqlite
      .prepare('SELECT id FROM users WHERE phone = ?')
      .get(cleanPhone) as { id: string } | undefined;
    if (existing) {
      res.status(409).json({ error: 'Un compte existe déjà avec ce numéro de téléphone.' });
      return;
    }

    const id = `usr-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const cleanName = fullName.trim().slice(0, 80);
    const cleanEmail = typeof email === 'string' && email.trim() ? email.trim().slice(0, 120) : '';
    const cleanCommune =
      typeof commune === 'string' && commune.trim()
        ? commune.trim().slice(0, 80)
        : 'Kinshasa';

    sqlite
      .prepare(
        `INSERT INTO users (id, full_name, phone, email, commune, default_anonymous, password_hash, active, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?)`
      )
      .run(id, cleanName, cleanPhone, cleanEmail, cleanCommune, hashPassword(password), createdAt);

    const user: StoredUser = {
      id,
      fullName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      commune: cleanCommune,
      defaultAnonymous: false,
      active: true,
      createdAt,
    };

    res.status(201).json({ token: signToken(user.id), user });
  });

  app.post('/api/auth/login', (req, res) => {
    const { phone, password } = req.body ?? {};
    if (typeof phone !== 'string' || typeof password !== 'string' || !phone.trim() || !password) {
      res.status(400).json({ error: 'Numéro de téléphone et mot de passe requis.' });
      return;
    }
    const cleanPhone = normalizePhone(phone);
    const row = sqlite
      .prepare('SELECT * FROM users WHERE phone = ? AND active = 1')
      .get(cleanPhone) as Record<string, unknown> | undefined;

    if (!row || typeof row.password_hash !== 'string' || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Numéro de téléphone ou mot de passe incorrect.' });
      return;
    }

    const user = rowToUser(row);
    res.json({ token: signToken(user.id), user });
  });

  /* --------------------------- Public Endpoints --------------------------- */
  app.get('/api/public/feed', (req: AuthenticatedRequest, res) => {
    const caller = optionalCitizenAuth(req);
    const alerts = (
      sqlite.prepare('SELECT * FROM official_alerts ORDER BY created_at DESC LIMIT 100').all() as Record<
        string,
        unknown
      >[]
    ).map(rowToAlert);

    const favSet = new Set<string>();
    if (caller) {
      const favRows = sqlite
        .prepare('SELECT station_id FROM user_station_favorites WHERE user_id = ?')
        .all(caller.id) as { station_id: string }[];
      for (const f of favRows) favSet.add(f.station_id);
    }

    const stations = (
      sqlite.prepare('SELECT * FROM stations ORDER BY name ASC').all() as Record<string, unknown>[]
    ).map((r) => rowToStation(r, favSet));

    const mapIncidents = (
      sqlite
        .prepare(
          `SELECT * FROM reports WHERE status IN ('Confirmée', 'Affectée à une équipe', 'Intervention en cours')
           ORDER BY created_at DESC LIMIT 100`
        )
        .all() as Record<string, unknown>[]
    ).map((r) => toPublicMapIncident(rowToReport(r)));

    res.json({ officialAlerts: alerts, stations, mapIncidents });
  });

  app.get('/api/geocode', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Coordonnées GPS invalides.' });
      return;
    }

    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat
        )}&lon=${encodeURIComponent(lng)}&accept-language=fr`,
        {
          headers: { 'User-Agent': 'PNC-Alerte-RDC/1.0' },
          signal: AbortSignal.timeout(4000),
        }
      );
      if (nomRes.ok) {
        const nomData = (await nomRes.json()) as {
          display_name?: string;
          address?: { road?: string; suburb?: string; city?: string; town?: string };
        };
        const parts = [
          nomData.address?.road,
          nomData.address?.suburb,
          nomData.address?.city || nomData.address?.town,
        ].filter(Boolean);
        if (parts.length > 0) {
          address = parts.join(', ');
        } else if (nomData.display_name) {
          address = nomData.display_name.split(',').slice(0, 3).join(',').trim();
        }
      }
    } catch {
      // Fallback cleanly to exact GPS coordinates without inventing street names
    }

    res.json({ latitude: lat, longitude: lng, address });
  });

  app.get('/api/documents/verify', (req, res) => {
    const number = typeof req.query.number === 'string' ? req.query.number.trim().toUpperCase() : '';
    if (!number || number.length < 4) {
      res.status(400).json({ error: 'Numéro de document requis.' });
      return;
    }

    const docRow = sqlite
      .prepare('SELECT * FROM verifiable_documents WHERE UPPER(number) = ?')
      .get(number) as Record<string, unknown> | undefined;
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

    const complaintRow = sqlite
      .prepare('SELECT * FROM complaints WHERE UPPER(reference) = ?')
      .get(number) as Record<string, unknown> | undefined;
    if (complaintRow) {
      const c = rowToComplaint(complaintRow);
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

    res.json({ found: false, query: number });
  });

  /* --------------------------- Citizen Personal API ----------------------- */
  app.get('/api/citizen/me', requireCitizenAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;

    const reports = (
      sqlite
        .prepare('SELECT * FROM reports WHERE reporter_id = ? ORDER BY created_at DESC')
        .all(user.id) as Record<string, unknown>[]
    ).map(rowToReport);

    const complaints = (
      sqlite
        .prepare('SELECT * FROM complaints WHERE citizen_id = ? ORDER BY created_at DESC')
        .all(user.id) as Record<string, unknown>[]
    ).map(rowToComplaint);

    const notifications = (
      sqlite
        .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
        .all(user.id) as Record<string, unknown>[]
    ).map(rowToNotification);

    const chatMessages = (
      sqlite
        .prepare('SELECT * FROM chat_messages WHERE citizen_id = ? ORDER BY created_at ASC LIMIT 100')
        .all(user.id) as Record<string, unknown>[]
    ).map(rowToChatMessage);

    res.json({ user, reports, complaints, notifications, chatMessages });
  });

  app.patch('/api/profile', requireCitizenAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const { fullName, commune, defaultAnonymous } = req.body ?? {};
    const nextName =
      typeof fullName === 'string' && fullName.trim().length >= 2
        ? fullName.trim().slice(0, 80)
        : user.fullName;
    const nextCommune =
      typeof commune === 'string' && commune.trim().length >= 2
        ? commune.trim().slice(0, 80)
        : user.commune;
    const nextAnon = typeof defaultAnonymous === 'boolean' ? defaultAnonymous : user.defaultAnonymous;

    sqlite
      .prepare('UPDATE users SET full_name = ?, commune = ?, default_anonymous = ? WHERE id = ?')
      .run(nextName, nextCommune, nextAnon ? 1 : 0, user.id);

    res.json({
      user: {
        ...user,
        fullName: nextName,
        commune: nextCommune,
        defaultAnonymous: nextAnon,
      },
    });
  });

  app.post('/api/stations/:id/favorite', requireCitizenAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const stationId = req.params.id;
    const station = sqlite.prepare('SELECT id FROM stations WHERE id = ?').get(stationId);
    if (!station) {
      res.status(404).json({ error: 'Commissariat introuvable.' });
      return;
    }
    const existing = sqlite
      .prepare('SELECT 1 FROM user_station_favorites WHERE user_id = ? AND station_id = ?')
      .get(user.id, stationId);
    if (existing) {
      sqlite
        .prepare('DELETE FROM user_station_favorites WHERE user_id = ? AND station_id = ?')
        .run(user.id, stationId);
      res.json({ stationId, isFavorite: false });
    } else {
      sqlite
        .prepare('INSERT INTO user_station_favorites (user_id, station_id) VALUES (?, ?)')
        .run(user.id, stationId);
      res.json({ stationId, isFavorite: true });
    }
  });

  app.post('/api/notifications/read-all', requireCitizenAuth, (req: AuthenticatedRequest, res) => {
    sqlite.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.authUser!.id);
    res.json({ ok: true });
  });

  app.patch('/api/notifications/:id/read', requireCitizenAuth, (req: AuthenticatedRequest, res) => {
    sqlite
      .prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.authUser!.id);
    res.json({ ok: true });
  });

  app.post('/api/reports', (req: AuthenticatedRequest, res) => {
    const caller = optionalCitizenAuth(req);
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

    const isAnon = Boolean(anonymous);
    const sosFlag = Boolean(isSos);
    const now = new Date();
    const createdAt = now.toISOString();
    const countRow = sqlite.prepare('SELECT COUNT(*) as total FROM reports').get() as { total: number };
    const seq = String((countRow?.total || 0) + 1).padStart(6, '0');
    const reference = `${sosFlag ? 'SOS' : 'PNC'}-${now.getFullYear()}-${seq}`;
    const id = `rep-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;

    const cleanAttachments = sanitizeAttachments(attachments);
    const cleanLocation =
      typeof location === 'string' && location.trim()
        ? location.trim().slice(0, 140)
        : caller?.commune || 'Position non précisée';
    const cleanLat = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null;
    const cleanLng = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null;
    const reporterId = caller?.id || null;
    const reporterName = isAnon
      ? null
      : (typeof contactName === 'string' && contactName.trim()
          ? contactName.trim().slice(0, 80)
          : caller?.fullName) || null;
    const reporterPhone = isAnon
      ? null
      : (typeof contactPhone === 'string' && contactPhone.trim()
          ? contactPhone.trim().slice(0, 30)
          : caller?.phone) || null;

    const timestamp = formatTimestampFr(now);

    sqlite
      .prepare(
        `INSERT INTO reports (
          id, reference, category, description, location, latitude, longitude, timestamp, created_at,
          status, filter_key, anonymous, reporter_id, reporter_name, reporter_phone, attachments_json, is_sos
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Nouvelle', 'encours', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        reference,
        category.trim().slice(0, 60),
        description.trim().slice(0, 1000),
        cleanLocation,
        cleanLat,
        cleanLng,
        timestamp,
        createdAt,
        isAnon ? 1 : 0,
        reporterId,
        reporterName,
        reporterPhone,
        JSON.stringify(cleanAttachments),
        sosFlag ? 1 : 0
      );

    const created = rowToReport(
      sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Record<string, unknown>
    );

    if (caller) {
      createCitizenNotification(
        caller.id,
        sosFlag ? 'Alerte SOS transmise' : 'Signalement transmis',
        `Votre dossier ${created.reference} a été transmis au Centre de Commandement PNC (statut : Nouvelle).`,
        'live-tracking'
      );
    }

    broadcastToCommandAndUser(caller?.id, 'report:created', created);
    void notifyCommandWebhook('report:created', created);

    res.status(201).json(created);
  });

  app.post('/api/complaints', requireCitizenAuth, (req: AuthenticatedRequest, res) => {
    const caller = req.authUser!;
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
    const countRow = sqlite.prepare('SELECT COUNT(*) as total FROM complaints').get() as { total: number };
    const seq = String((countRow?.total || 0) + 1).padStart(6, '0');
    const reference = `PL-${now.getFullYear()}-${seq}`;
    const id = `pl-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const cleanAttachments = Array.isArray(attachments)
      ? attachments.slice(0, 6).map((a) => String(a).trim().slice(0, 120))
      : [];

    sqlite
      .prepare(
        `INSERT INTO complaints (
          id, reference, type, location, description, date, created_at, status,
          attachments_json, assigned_station, citizen_id, citizen_name, citizen_phone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Reçue', ?, 'En attente d’affectation (Centre de Commandement)', ?, ?, ?)`
      )
      .run(
        id,
        reference,
        type.trim().slice(0, 80),
        location.trim().slice(0, 140),
        description.trim().slice(0, 1500),
        now.toLocaleDateString('fr-FR'),
        createdAt,
        JSON.stringify(cleanAttachments),
        caller.id,
        caller.fullName,
        caller.phone
      );

    const created = rowToComplaint(
      sqlite.prepare('SELECT * FROM complaints WHERE id = ?').get(id) as Record<string, unknown>
    );

    createCitizenNotification(
      caller.id,
      'Plainte enregistrée',
      `Votre plainte ${created.reference} a été transmise au Centre de Commandement PNC.`,
      'complaints-history'
    );

    broadcastToCommandAndUser(caller.id, 'complaint:created', created);
    void notifyCommandWebhook('complaint:created', created);

    res.status(201).json(created);
  });

  app.post('/api/chat', requireCitizenAuth, (req: AuthenticatedRequest, res) => {
    const caller = req.authUser!;
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

    sqlite
      .prepare(
        `INSERT INTO chat_messages (id, report_id, citizen_id, sender, sender_name, text, time, created_at)
         VALUES (?, ?, ?, 'user', ?, ?, ?, ?)`
      )
      .run(id, cleanReportId, caller.id, caller.fullName, text.trim().slice(0, 800), time, createdAt);

    const msg = rowToChatMessage(
      sqlite.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as Record<string, unknown>
    );

    broadcastToCommandAndUser(caller.id, 'chat:message', msg);
    void notifyCommandWebhook('chat:message', msg);

    res.status(201).json(msg);
  });

  /* ============== External Command Center Integration API ================= */
  app.get('/api/command/health', requireCommandKey, (_req, res) => {
    const usersCount = (sqlite.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
    const reportsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM reports').get() as { c: number }).c;
    const complaintsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM complaints').get() as { c: number }).c;
    const stationsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM stations').get() as { c: number }).c;
    const alertsCount = (sqlite.prepare('SELECT COUNT(*) as c FROM official_alerts').get() as { c: number }).c;

    res.json({
      status: 'ok',
      service: 'pnc-alerte-citizen-backend',
      timestamp: new Date().toISOString(),
      counts: {
        users: usersCount,
        reports: reportsCount,
        complaints: complaintsCount,
        stations: stationsCount,
        officialAlerts: alertsCount,
      },
    });
  });

  app.get('/api/command/sync', requireCommandKey, (req, res) => {
    const since = typeof req.query.since === 'string' && req.query.since.trim() ? req.query.since.trim() : null;

    const reports = (
      since
        ? (sqlite
            .prepare('SELECT * FROM reports WHERE created_at >= ? ORDER BY created_at DESC')
            .all(since) as Record<string, unknown>[])
        : (sqlite.prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as Record<string, unknown>[])
    ).map(rowToReport);

    const complaints = (
      since
        ? (sqlite
            .prepare('SELECT * FROM complaints WHERE created_at >= ? ORDER BY created_at DESC')
            .all(since) as Record<string, unknown>[])
        : (sqlite.prepare('SELECT * FROM complaints ORDER BY created_at DESC').all() as Record<string, unknown>[])
    ).map(rowToComplaint);

    const stations = (
      sqlite.prepare('SELECT * FROM stations ORDER BY name ASC').all() as Record<string, unknown>[]
    ).map((r) => rowToStation(r));

    const officialAlerts = (
      sqlite.prepare('SELECT * FROM official_alerts ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(rowToAlert);

    const chatMessages = (
      since
        ? (sqlite
            .prepare('SELECT * FROM chat_messages WHERE created_at >= ? ORDER BY created_at ASC')
            .all(since) as Record<string, unknown>[])
        : (sqlite.prepare('SELECT * FROM chat_messages ORDER BY created_at ASC').all() as Record<
            string,
            unknown
          >[])
    ).map(rowToChatMessage);

    const citizensCount = (sqlite.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;

    res.json({
      syncedAt: new Date().toISOString(),
      citizensCount,
      reports,
      complaints,
      stations,
      officialAlerts,
      chatMessages,
    });
  });

  app.get('/api/command/reports', requireCommandKey, (_req, res) => {
    const reports = (
      sqlite.prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as Record<string, unknown>[]
    ).map(rowToReport);
    res.json(reports);
  });

  app.patch('/api/command/reports/:id/status', requireCommandKey, (req, res) => {
    const row = sqlite
      .prepare('SELECT * FROM reports WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Signalement introuvable.' });
      return;
    }
    const report = rowToReport(row);
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

    const nextFilterKey: 'encours' | 'cloturee' =
      nextStatus === 'Résolue' || nextStatus === 'Clôturée' ? 'cloturee' : 'encours';
    const nextPatrolUnit =
      typeof patrolUnit === 'string' && patrolUnit.trim()
        ? patrolUnit.trim().slice(0, 80)
        : report.patrolUnit || null;
    const nextStationId =
      typeof assignedStationId === 'string' && assignedStationId.trim()
        ? assignedStationId.trim().slice(0, 60)
        : report.assignedStationId || null;
    const nextEta =
      typeof etaMinutes === 'number' && Number.isFinite(etaMinutes) && etaMinutes > 0
        ? Math.round(etaMinutes)
        : report.etaMinutes ?? null;
    const nextValidatedBy =
      typeof validatedBy === 'string' && validatedBy.trim()
        ? validatedBy.trim().slice(0, 80)
        : report.validatedBy || null;
    const nextNotes =
      typeof validationNotes === 'string' && validationNotes.trim()
        ? validationNotes.trim().slice(0, 400)
        : report.validationNotes || null;

    sqlite
      .prepare(
        `UPDATE reports
         SET status = ?, filter_key = ?, patrol_unit = ?, assigned_station_id = ?, eta_minutes = ?,
             validated_by = ?, validation_notes = ?
         WHERE id = ?`
      )
      .run(
        nextStatus,
        nextFilterKey,
        nextPatrolUnit,
        nextStationId,
        nextEta,
        nextValidatedBy,
        nextNotes,
        report.id
      );

    const updated = rowToReport(
      sqlite.prepare('SELECT * FROM reports WHERE id = ?').get(report.id) as Record<string, unknown>
    );

    if (updated.reporterId) {
      createCitizenNotification(
        updated.reporterId,
        `Signalement ${updated.reference}`,
        `Statut mis à jour : ${updated.status}${updated.patrolUnit ? ` (${updated.patrolUnit})` : ''}.`,
        'live-tracking'
      );
    }

    broadcastToCommandAndUser(updated.reporterId, 'report:updated', updated);
    broadcastPublicMapUpdate(updated);

    res.json(updated);
  });

  app.get('/api/command/complaints', requireCommandKey, (_req, res) => {
    const complaints = (
      sqlite.prepare('SELECT * FROM complaints ORDER BY created_at DESC').all() as Record<
        string,
        unknown
      >[]
    ).map(rowToComplaint);
    res.json(complaints);
  });

  app.patch('/api/command/complaints/:id', requireCommandKey, (req, res) => {
    const row = sqlite
      .prepare('SELECT * FROM complaints WHERE id = ?')
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Plainte introuvable.' });
      return;
    }
    const existing = rowToComplaint(row);
    const { status, assignedStation } = req.body ?? {};
    const nextStatus =
      typeof status === 'string' && VALID_COMPLAINT_STATUSES.includes(status as ComplaintStatus)
        ? (status as ComplaintStatus)
        : existing.status;
    const nextStation =
      typeof assignedStation === 'string' && assignedStation.trim()
        ? assignedStation.trim().slice(0, 80)
        : existing.assignedStation;

    sqlite
      .prepare('UPDATE complaints SET status = ?, assigned_station = ? WHERE id = ?')
      .run(nextStatus, nextStation, existing.id);

    const updated = rowToComplaint(
      sqlite.prepare('SELECT * FROM complaints WHERE id = ?').get(existing.id) as Record<
        string,
        unknown
      >
    );

    createCitizenNotification(
      updated.citizenId,
      `Plainte ${updated.reference}`,
      `Statut actualisé : ${updated.status} · ${updated.assignedStation}.`,
      'complaints-history'
    );

    broadcastToCommandAndUser(updated.citizenId, 'complaint:updated', updated);
    res.json(updated);
  });

  app.post('/api/command/alerts', requireCommandKey, (req, res) => {
    const { title, category, summary, fullDetails, location, priority, publishedBy } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || typeof summary !== 'string' || !summary.trim()) {
      res.status(400).json({ error: 'Titre et résumé requis.' });
      return;
    }
    const cat: 'securite' | 'avis' | 'info' =
      category === 'securite' || category === 'avis' ? category : 'info';
    const catLabels: Record<'securite' | 'avis' | 'info', string> = {
      securite: 'Sécurité',
      avis: 'Avis',
      info: 'Info',
    };
    const icons: Record<'securite' | 'avis' | 'info', string> = {
      securite: 'warning',
      avis: 'search',
      info: 'campaign',
    };

    const id = `oa-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const createdAt = new Date().toISOString();
    const prio = priority === 'high' || priority === 'medium' ? priority : 'normal';

    sqlite
      .prepare(
        `INSERT INTO official_alerts (id, title, category, category_label, summary, full_details, location, created_at, icon, priority, published_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        title.trim().slice(0, 80),
        cat,
        catLabels[cat],
        summary.trim().slice(0, 160),
        typeof fullDetails === 'string' && fullDetails.trim()
          ? fullDetails.trim().slice(0, 1000)
          : summary.trim().slice(0, 160),
        typeof location === 'string' && location.trim() ? location.trim().slice(0, 100) : 'Kinshasa',
        createdAt,
        icons[cat],
        prio,
        typeof publishedBy === 'string' && publishedBy.trim()
          ? publishedBy.trim().slice(0, 80)
          : 'Centre de Commandement PNC'
      );

    const created = rowToAlert(
      sqlite.prepare('SELECT * FROM official_alerts WHERE id = ?').get(id) as Record<string, unknown>
    );
    broadcastAll('alert:created', created);
    res.status(201).json(created);
  });

  app.delete('/api/command/alerts/:id', requireCommandKey, (req, res) => {
    const result = sqlite.prepare('DELETE FROM official_alerts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Alerte introuvable.' });
      return;
    }
    broadcastAll('alert:deleted', { id: req.params.id });
    res.json({ ok: true });
  });

  app.post('/api/command/stations', requireCommandKey, (req, res) => {
    const { id, name, address, commune, phone, hours, latitude, longitude, operationalStatus, activeUnits } =
      req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || typeof commune !== 'string' || !commune.trim()) {
      res.status(400).json({ error: 'Nom et commune du commissariat requis.' });
      return;
    }
    const stationId =
      typeof id === 'string' && id.trim()
        ? id.trim().slice(0, 60)
        : `st-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const opStatus =
      operationalStatus === 'Alerte renforcée' || operationalStatus === 'Maintenance'
        ? operationalStatus
        : 'Opérationnel';
    const updatedAt = new Date().toISOString();

    sqlite
      .prepare(
        `INSERT INTO stations (id, name, address, commune, phone, hours, latitude, longitude, operational_status, active_units, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           address = excluded.address,
           commune = excluded.commune,
           phone = excluded.phone,
           hours = excluded.hours,
           latitude = excluded.latitude,
           longitude = excluded.longitude,
           operational_status = excluded.operational_status,
           active_units = excluded.active_units,
           updated_at = excluded.updated_at`
      )
      .run(
        stationId,
        name.trim().slice(0, 80),
        typeof address === 'string' && address.trim() ? address.trim().slice(0, 140) : commune.trim(),
        commune.trim().slice(0, 60),
        typeof phone === 'string' && phone.trim() ? phone.trim().slice(0, 30) : '112',
        typeof hours === 'string' && hours.trim() ? hours.trim().slice(0, 80) : 'Ouvert 24h/24',
        typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : null,
        typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : null,
        opStatus,
        typeof activeUnits === 'number' && Number.isFinite(activeUnits) && activeUnits >= 0
          ? Math.round(activeUnits)
          : 0,
        updatedAt
      );

    const allStations = (
      sqlite.prepare('SELECT * FROM stations ORDER BY name ASC').all() as Record<string, unknown>[]
    ).map((r) => rowToStation(r));

    broadcastAll('station:updated', allStations);
    res.status(201).json(allStations.find((s) => s.id === stationId));
  });

  app.delete('/api/command/stations/:id', requireCommandKey, (req, res) => {
    const result = sqlite.prepare('DELETE FROM stations WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Commissariat introuvable.' });
      return;
    }
    const allStations = (
      sqlite.prepare('SELECT * FROM stations ORDER BY name ASC').all() as Record<string, unknown>[]
    ).map((r) => rowToStation(r));
    broadcastAll('station:updated', allStations);
    res.json({ ok: true });
  });

  app.post('/api/command/documents', requireCommandKey, (req, res) => {
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
    const createdAt = new Date().toISOString();

    sqlite
      .prepare(
        `INSERT INTO verifiable_documents (number, type, holder_name, issued_by, issued_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(number) DO UPDATE SET
           type = excluded.type,
           holder_name = excluded.holder_name,
           issued_by = excluded.issued_by,
           issued_date = excluded.issued_date,
           status = excluded.status`
      )
      .run(
        cleanNum,
        type.trim().slice(0, 80),
        holderName.trim().slice(0, 80),
        typeof issuedBy === 'string' && issuedBy.trim() ? issuedBy.trim().slice(0, 80) : 'PNC',
        typeof issuedDate === 'string' && issuedDate.trim()
          ? issuedDate.trim().slice(0, 30)
          : new Date().toLocaleDateString('fr-FR'),
        docStatus,
        createdAt
      );

    res.status(201).json({ number: cleanNum, status: docStatus });
  });

  app.post('/api/command/chat', requireCommandKey, (req, res) => {
    const { citizenId, reportId, text, senderName } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Message vide.' });
      return;
    }

    let resolvedCitizenId = typeof citizenId === 'string' && citizenId.trim() ? citizenId.trim() : undefined;
    if (!resolvedCitizenId && typeof reportId === 'string' && reportId.trim()) {
      const rRow = sqlite
        .prepare('SELECT reporter_id FROM reports WHERE id = ?')
        .get(reportId.trim()) as { reporter_id?: string } | undefined;
      if (rRow?.reporter_id) resolvedCitizenId = rRow.reporter_id;
    }

    const now = new Date();
    const id = `msg-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const createdAt = now.toISOString();
    const cleanSender =
      typeof senderName === 'string' && senderName.trim()
        ? senderName.trim().slice(0, 80)
        : 'Salle de Commandement PNC';

    sqlite
      .prepare(
        `INSERT INTO chat_messages (id, report_id, citizen_id, sender, sender_name, text, time, created_at)
         VALUES (?, ?, ?, 'dispatch', ?, ?, ?, ?)`
      )
      .run(
        id,
        typeof reportId === 'string' && reportId.trim() ? reportId.trim() : null,
        resolvedCitizenId || null,
        cleanSender,
        text.trim().slice(0, 800),
        time,
        createdAt
      );

    const msg = rowToChatMessage(
      sqlite.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as Record<string, unknown>
    );

    if (resolvedCitizenId) {
      createCitizenNotification(
        resolvedCitizenId,
        'Message du Centre PNC',
        msg.text.slice(0, 120),
        'dispatch-chat'
      );
    }

    broadcastToCommandAndUser(resolvedCitizenId, 'chat:message', msg);
    res.status(201).json(msg);
  });

  /* ---------------------- Vite Dev / Production Serve --------------------- */
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PNC Alerte Citizen backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PNC Alerte server:', err);
  process.exit(1);
});
