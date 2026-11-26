export type ScreenId =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'official-alerts'
  | 'incident-map'
  | 'police-stations'
  | 'report-step1'
  | 'report-step2'
  | 'report-step3'
  | 'my-alerts'
  | 'file-complaint'
  | 'complaints-history'
  | 'live-tracking'
  | 'doc-verification'
  | 'sos-alert'
  | 'prevention-center'
  | 'emergency-directory'
  | 'dispatch-chat'
  | 'notifications'
  | 'profile';

export type OfficialAlertCategory = 'securite' | 'avis' | 'info';

export interface OfficialAlert {
  id: string;
  title: string;
  category: OfficialAlertCategory;
  categoryLabel: string;
  summary: string;
  fullDetails: string;
  location: string;
  createdAt?: string;
  timeAgo: string;
  icon: string;
  priority: 'high' | 'medium' | 'normal';
  publishedBy?: string;
}

export type ReportStatus =
  | 'Nouvelle'
  | 'En vérification'
  | 'Confirmée'
  | 'Affectée à une équipe'
  | 'Intervention en cours'
  | 'Résolue'
  | 'Clôturée';

export interface MediaAttachment {
  id: string;
  type: 'photo' | 'video' | 'audio';
  name: string;
  sizeOrDuration: string;
  dataUrl?: string;
}

export interface IncidentReport {
  id: string;
  reference: string;
  category: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  createdAt?: string;
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
  isSos?: boolean;
}

export interface PublicMapIncident {
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

export type ComplaintStatus =
  | 'Reçue'
  | "En cours d'enquête"
  | 'Transmise au parquet'
  | 'Clôturée';

export interface Complaint {
  id: string;
  reference: string;
  type: string;
  location: string;
  description: string;
  date: string;
  createdAt?: string;
  status: ComplaintStatus;
  attachments: string[];
  assignedStation: string;
  citizenId?: string;
  citizenName?: string;
  citizenPhone?: string;
}

export interface PoliceStation {
  id: string;
  name: string;
  address: string;
  commune: string;
  phone: string;
  hours: string;
  isFavorite?: boolean;
  latitude?: number;
  longitude?: number;
  operationalStatus?: 'Opérationnel' | 'Alerte renforcée' | 'Maintenance';
  activeUnits?: number;
  updatedAt?: string;
}

export interface VerifiableDocument {
  number: string;
  type: string;
  holderName: string;
  issuedBy: string;
  issuedDate: string;
  status: 'Valide' | 'En cours' | 'Expiré';
}

export interface UserProfile {
  id?: string;
  fullName: string;
  phone: string;
  email: string;
  commune: string;
  defaultAnonymous: boolean;
  active?: boolean;
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  reportId?: string;
  citizenId?: string;
  sender: 'user' | 'dispatch';
  senderName?: string;
  text: string;
  time: string;
  createdAt?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  createdAt?: string;
  read: boolean;
  targetScreen?: ScreenId;
}

export interface ReportDraft {
  category: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  attachments: MediaAttachment[];
  anonymous: boolean;
  contactName: string;
  contactPhone: string;
}
