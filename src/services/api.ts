import {
  AppNotification,
  ChatMessage,
  Complaint,
  IncidentReport,
  MediaAttachment,
  OfficialAlert,
  PoliceStation,
  PublicMapIncident,
  UserProfile,
  VerifiableDocument,
} from '../types';

export interface PublicFeedResponse {
  officialAlerts: OfficialAlert[];
  stations: PoliceStation[];
  mapIncidents: PublicMapIncident[];
}

export interface CitizenMeResponse {
  user: UserProfile;
  reports: IncidentReport[];
  complaints: Complaint[];
  notifications: AppNotification[];
  chatMessages: ChatMessage[];
}

export interface DocumentVerifyResponse {
  found: boolean;
  query?: string;
  document?: VerifiableDocument;
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const errMsg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Erreur serveur (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export const pncApi = {
  publicFeed: (token?: string | null) =>
    apiRequest<PublicFeedResponse>('/api/public/feed', {}, token),

  citizenMe: (token: string) =>
    apiRequest<CitizenMeResponse>('/api/citizen/me', {}, token),

  geocode: (lat: number, lng: number) =>
    apiRequest<{ latitude: number; longitude: number; address: string }>(
      `/api/geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    ),

  verifyDocument: (number: string) =>
    apiRequest<DocumentVerifyResponse>(
      `/api/documents/verify?number=${encodeURIComponent(number)}`
    ),

  registerCitizen: (payload: {
    fullName: string;
    phone: string;
    email?: string;
    commune?: string;
    password: string;
  }) =>
    apiRequest<{
      token: string;
      user: UserProfile;
      requiresEmailConfirmation?: boolean;
      message?: string;
    }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  loginCitizen: (payload: { phone?: string; email?: string; password: string }) =>
    apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProfile: (
    patch: { fullName?: string; commune?: string; defaultAnonymous?: boolean },
    token: string
  ) =>
    apiRequest<{ user: UserProfile }>(
      '/api/profile',
      { method: 'PATCH', body: JSON.stringify(patch) },
      token
    ),

  toggleFavoriteStation: (stationId: string, token: string) =>
    apiRequest<{ stationId: string; isFavorite: boolean }>(
      `/api/stations/${encodeURIComponent(stationId)}/favorite`,
      { method: 'POST' },
      token
    ),

  markNotificationRead: (notificationId: string, token: string) =>
    apiRequest<{ ok: boolean }>(
      `/api/notifications/${encodeURIComponent(notificationId)}/read`,
      { method: 'PATCH' },
      token
    ),

  markAllNotificationsRead: (token: string) =>
    apiRequest<{ ok: boolean }>('/api/notifications/read-all', { method: 'POST' }, token),

  createReport: (
    payload: {
      category: string;
      description: string;
      location: string;
      latitude?: number;
      longitude?: number;
      attachments: MediaAttachment[];
      anonymous: boolean;
      contactName?: string;
      contactPhone?: string;
      isSos?: boolean;
    },
    token?: string | null
  ) =>
    apiRequest<IncidentReport>(
      '/api/reports',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  createComplaint: (
    payload: { type: string; location: string; description: string; attachments: string[] },
    token: string
  ) =>
    apiRequest<Complaint>(
      '/api/complaints',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),

  sendChatMessage: (payload: { text: string; reportId?: string }, token: string) =>
    apiRequest<ChatMessage>(
      '/api/chat',
      { method: 'POST', body: JSON.stringify(payload) },
      token
    ),
};
