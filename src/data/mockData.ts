import { ReportStatus, UserProfile } from '../types';

export const ASSETS = {
  pncCrest: '/assets/aistudio/Emblem_of_the_Congolese_National_Police__DR_Congo_.svg_e16f7249.png',
  onboardingPolice: '/src/assets/images/onboarding_police_1795689256912.jpg',
  onboardingAlert: '/src/assets/images/onboarding_alert_1795689257631.jpg',
  onboardingCommunity: '/src/assets/images/onboarding_community_1795689257681.jpg',
} as const;

export const REPORT_STATUS_ORDER: ReportStatus[] = [
  'Nouvelle',
  'En vérification',
  'Confirmée',
  'Affectée à une équipe',
  'Intervention en cours',
  'Résolue',
  'Clôturée',
];

export const KINSHASA_COMMUNES = [
  'Bandalungwa, Kinshasa',
  'Barumbu, Kinshasa',
  'Bumbu, Kinshasa',
  'Gombe, Kinshasa',
  'Kalamu, Kinshasa',
  'Kasa-Vubu, Kinshasa',
  'Kimbanseke, Kinshasa',
  'Kinshasa, Kinshasa',
  'Kintambo, Kinshasa',
  'Kisenso, Kinshasa',
  'Lemba, Kinshasa',
  'Limete, Kinshasa',
  'Lingwala, Kinshasa',
  'Makala, Kinshasa',
  'Maluku, Kinshasa',
  'Masina, Kinshasa',
  'Matete, Kinshasa',
  'Mont-Ngafula, Kinshasa',
  'Ndjili, Kinshasa',
  'Ngaba, Kinshasa',
  'Ngaliema, Kinshasa',
  'Ngiri-Ngiri, Kinshasa',
  'Nsele, Kinshasa',
  'Selembao, Kinshasa',
];

export const EMPTY_USER: UserProfile = {
  fullName: '',
  phone: '',
  email: '',
  commune: 'Kinshasa',
  defaultAnonymous: false,
};

export const PREVENTION_GUIDES = [
  {
    id: 'prev-1',
    category: 'Sécurité personnelle',
    title: 'Réagir face aux menaces urbaines (Kuluna)',
    summary: 'Adoptez les bons réflexes lors de vos déplacements en soirée et évitez l’isolement.',
    tips: [
      'Privilégiez les grands axes éclairés et informez un proche de votre itinéraire.',
      'En cas d’agression, privilégiez toujours votre intégrité physique plutôt que vos biens matériels.',
      'Activez le mode Alerte Discrète (SOS) depuis le tableau de bord pour transmettre votre position GPS.',
    ],
    icon: 'shield',
  },
  {
    id: 'prev-2',
    category: 'Sécurité routière',
    title: 'Conduite préventive et accidents (PCR)',
    summary: 'Procédures en cas de collision ou de contrôle routier sur les boulevards de Kinshasa.',
    tips: [
      'Sécurisez la zone avec des feux de détresse avant de sortir du véhicule.',
      'Photographiez les positions des véhicules et les plaques d’immatriculation via l’outil de capture.',
      'Signalez immédiatement tout délit de fuite avec le numéro de plaque.',
    ],
    icon: 'directions_car',
  },
  {
    id: 'prev-3',
    category: 'Cyber & Escroquerie',
    title: 'Prévenir les arnaques Mobile Money',
    summary: 'Protégez vos comptes contre les appels frauduleux et faux agents.',
    tips: [
      'Ne partagez jamais votre code PIN ni aucun code OTP reçu par SMS.',
      'Vérifiez toujours l’authenticité d’une convocation ou d’un document via Vérification documentaire.',
      'Conservez les captures d’écran et numéros de téléphone pour déposer plainte en ligne.',
    ],
    icon: 'lock',
  },
  {
    id: 'prev-4',
    category: 'Protection familiale',
    title: 'Réagir en cas de disparition d’un proche',
    summary: 'Chaque minute compte : déclenchez une alerte sans attendre 24 heures.',
    tips: [
      'Il n’y a aucun délai d’attente obligatoire pour signaler la disparition d’un enfant ou d’une personne vulnérable.',
      'Préparez une photo récente et la description précise des vêtements portés.',
      'Contactez simultanément le 112 et le commissariat le plus proche.',
    ],
    icon: 'family_restroom',
  },
];

export const EMERGENCY_NUMBERS = [
  {
    id: 'em-1',
    name: 'Police Nationale Congolaise (Urgence)',
    number: '112',
    description: 'Centre national de commandement et intervention rapide 24h/24',
    icon: 'local_police',
    tone: 'primary' as const,
  },
  {
    id: 'em-2',
    name: 'Sapeurs-Pompiers / Incendie',
    number: '118',
    description: 'Secours incendie, sauvetage et accidents graves',
    icon: 'local_fire_department',
    tone: 'sos' as const,
  },
  {
    id: 'em-3',
    name: 'Ligne Verte Protection de l’Enfant',
    number: '116',
    description: 'Signalement anonyme de violences, disparitions ou mise en danger de mineurs',
    icon: 'child_care',
    tone: 'warning' as const,
  },
];
