import React, { useEffect, useState } from 'react';
import { EMERGENCY_NUMBERS, KINSHASA_COMMUNES, PREVENTION_GUIDES } from '../data/mockData';
import { pncApi } from '../services/api';
import { AppNotification, ChatMessage, ScreenId, UserProfile } from '../types';
import { MaterialIcon } from './MaterialIcon';

/* -------------------------------------------------------------------------- */
/* SOS Emergency Screen                                                        */
/* -------------------------------------------------------------------------- */
interface SosAlertScreenProps {
  user: UserProfile;
  onCancel: () => void;
  onTriggerEmergencyReport: (coords?: { latitude: number; longitude: number; address?: string }) => Promise<void>;
}

export const SosAlertScreen: React.FC<SosAlertScreenProps> = ({
  user,
  onCancel,
  onTriggerEmergencyReport,
}) => {
  const [countdown, setCountdown] = useState(5);
  const [sending, setSending] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [error, setError] = useState('');
  const [silentMode, setSilentMode] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; address?: string } | undefined>(
    undefined
  );

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          try {
            const geo = await pncApi.geocode(latitude, longitude);
            setGpsCoords({ latitude, longitude, address: geo.address });
          } catch {
            setGpsCoords({ latitude, longitude });
          }
        },
        () => {
          // Proceed with user commune if GPS unavailable
        },
        { enableHighAccuracy: true, timeout: 4500 }
      );
    }
  }, []);

  const submitSos = async () => {
    if (sending || dispatched) return;
    setSending(true);
    setError('');
    try {
      await onTriggerEmergencyReport(gpsCoords);
      setDispatched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi SOS.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (dispatched || sending || error) return;
    if (countdown <= 0) {
      void submitSos();
      return;
    }
    const timer = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, dispatched, sending, error]);

  return (
    <div className="min-h-screen w-full bg-sos-red text-on-sos-red flex flex-col justify-between px-6 py-8">
      <header className="flex items-center justify-between max-w-lg w-full mx-auto">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-semibold flex items-center gap-1.5"
        >
          <MaterialIcon name="arrow_back" className="text-[18px]" />
          <span>Annuler</span>
        </button>
        <button
          type="button"
          onClick={() => setSilentMode((v) => !v)}
          className="min-h-[40px] px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <MaterialIcon name={silentMode ? 'volume_off' : 'volume_up'} className="text-[16px]" />
          <span>{silentMode ? 'Mode discret actif' : 'Mode discret'}</span>
        </button>
      </header>

      <main className="flex flex-col items-center text-center gap-6 max-w-md mx-auto my-auto">
        <div className="w-36 h-36 rounded-full bg-white text-sos-red flex flex-col items-center justify-center shadow-2xl border-4 border-sos-container">
          {dispatched ? (
            <>
              <MaterialIcon name="check_circle" filled className="text-[44px] text-success" />
              <span className="font-headline text-sm font-bold text-brand-navy mt-1">
                ALERTE TRANSMISE
              </span>
            </>
          ) : sending ? (
            <span className="font-headline text-sm font-bold text-brand-navy">ENVOI...</span>
          ) : (
            <>
              <span className="font-display text-5xl font-bold tabular-nums">{countdown}</span>
              <span className="font-label text-xs font-semibold tracking-wide">SECONDES</span>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold text-balance">
            {dispatched
              ? 'Alerte SOS transmise au Centre de Commandement'
              : "Envoi d'urgence SOS en cours..."}
          </h1>
          <p className="text-sm text-sos-container leading-relaxed">
            {dispatched
              ? `Votre position (${gpsCoords?.address || user.commune}) a été enregistrée (statut : Nouvelle) pour validation par un opérateur PNC.`
              : "Appuyez sur Annuler si vous avez déclenché l'alerte par erreur."}
          </p>
          {error && <p className="text-xs font-bold bg-black/25 rounded p-2">{error}</p>}
        </div>

        <div className="w-full flex flex-col gap-2.5 pt-2">
          {!dispatched && (
            <button
              type="button"
              onClick={() => {
                void submitSos();
              }}
              disabled={sending}
              className="w-full min-h-[48px] rounded-md bg-white text-sos-red font-headline font-bold text-sm hover:bg-sos-container transition-colors disabled:opacity-60"
            >
              {sending ? 'Transmission...' : 'Envoyer immédiatement'}
            </button>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-sos-container">
        Ligne directe nationale : 112 · Police Nationale Congolaise
      </footer>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Prevention Center Screen                                                    */
/* -------------------------------------------------------------------------- */
interface PreventionCenterScreenProps {
  onBack: () => void;
}

export const PreventionCenterScreen: React.FC<PreventionCenterScreenProps> = ({ onBack }) => {
  const [selectedGuideId, setSelectedGuideId] = useState<string>(PREVENTION_GUIDES[0].id);

  return (
    <div className="flex flex-col flex-1">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-4 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center gap-3 sticky top-0 z-20">
        <button
          type="button"
          aria-label="Retour"
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
        >
          <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
        </button>
        <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
          Conseils de sécurité
        </h1>
      </header>

      <main className="px-4 lg:px-6 py-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {PREVENTION_GUIDES.map((guide) => {
            const expanded = selectedGuideId === guide.id;
            return (
              <article
                key={guide.id}
                className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex flex-col gap-3"
              >
                <button
                  type="button"
                  onClick={() => setSelectedGuideId(expanded ? '' : guide.id)}
                  className="flex items-start gap-3 text-left w-full"
                >
                  <span className="w-10 h-10 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center shrink-0">
                    <MaterialIcon name={guide.icon} filled className="text-[20px]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-light-primary-container dark:text-dark-primary">
                      {guide.category}
                    </p>
                    <h2 className="font-headline text-sm font-bold text-light-on-surface dark:text-dark-on-surface mt-0.5">
                      {guide.title}
                    </h2>
                    <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1">
                      {guide.summary}
                    </p>
                  </div>
                  <MaterialIcon
                    name={expanded ? 'expand_less' : 'expand_more'}
                    className="text-light-on-surface-variant shrink-0"
                  />
                </button>

                {expanded && (
                  <ul className="pt-2 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-2 text-xs text-light-on-surface dark:text-dark-on-surface">
                    {guide.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <MaterialIcon
                          name="check_circle"
                          className="text-[16px] text-success shrink-0 mt-0.5"
                        />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Emergency Directory Screen                                                  */
/* -------------------------------------------------------------------------- */
interface EmergencyDirectoryScreenProps {
  onBack: () => void;
}

export const EmergencyDirectoryScreen: React.FC<EmergencyDirectoryScreenProps> = ({ onBack }) => {
  return (
    <div className="flex flex-col flex-1">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-4 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center gap-3 sticky top-0 z-20">
        <button
          type="button"
          aria-label="Retour"
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
        >
          <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
        </button>
        <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
          Annuaire d&apos;urgence
        </h1>
      </header>

      <main className="px-4 lg:px-6 py-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {EMERGENCY_NUMBERS.map((item) => (
            <article
              key={item.id}
              className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex items-center gap-3"
            >
              <span
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                  item.tone === 'sos'
                    ? 'bg-sos-container text-sos-red'
                    : item.tone === 'warning'
                    ? 'bg-warning-container text-warning'
                    : 'bg-light-secondary-container text-light-primary'
                }`}
              >
                <MaterialIcon name={item.icon} filled className="text-[22px]" />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="font-headline text-sm font-bold text-light-on-surface dark:text-dark-on-surface">
                  {item.name}
                </h2>
                <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  {item.description}
                </p>
                <p className="font-mono text-sm font-semibold text-light-primary-container dark:text-dark-primary mt-1 tabular-nums">
                  {item.number}
                </p>
              </div>
              <a
                href={`tel:${item.number.replace(/\s+/g, '')}`}
                aria-label={`Appeler ${item.name}`}
                className="min-h-[44px] min-w-[44px] px-3.5 rounded-md bg-light-primary-container text-light-on-primary-container font-headline text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-light-primary shrink-0"
              >
                <MaterialIcon name="call" className="text-[18px]" />
                <span className="hidden sm:inline">Appeler</span>
              </a>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Dispatch Chat Screen                                                        */
/* -------------------------------------------------------------------------- */
interface DispatchChatScreenProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  onBack: () => void;
}

export const DispatchChatScreen: React.FC<DispatchChatScreenProps> = ({
  messages,
  onSendMessage,
  onBack,
}) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(input.trim());
      setInput('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen lg:min-h-[calc(100vh-3rem)] bg-light-surface-container-lowest dark:bg-dark-surface-container-low lg:rounded-xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant lg:my-6 lg:mx-6 overflow-hidden">
      <header className="px-4 lg:px-6 pt-5 pb-3 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center gap-3">
        <button
          type="button"
          aria-label="Retour"
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-light-surface-container-low"
        >
          <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
        </button>
        <div>
          <h1 className="font-headline text-lg font-bold">Dispatching PNC</h1>
          <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Liaison directe avec le Centre de Commandement
          </p>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6 flex flex-col gap-3 overflow-y-auto bg-light-surface-container-low dark:bg-dark-background">
        {messages.length === 0 ? (
          <div className="m-auto text-center max-w-xs text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant flex flex-col items-center gap-2">
            <MaterialIcon name="forum" className="text-[32px] opacity-60" />
            <p>Aucun message échangé. Envoyez un message au Centre de Commandement PNC.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm flex flex-col gap-1 ${
                msg.sender === 'user'
                  ? 'self-end bg-light-primary-container text-light-on-primary-container'
                  : 'self-start bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface'
              }`}
            >
              {msg.senderName && msg.sender === 'dispatch' && (
                <span className="text-[11px] font-semibold text-light-primary dark:text-dark-primary">
                  {msg.senderName}
                </span>
              )}
              <p className="leading-relaxed">{msg.text}</p>
              <span
                className={`text-[10px] tabular-nums self-end ${
                  msg.sender === 'user' ? 'text-light-inverse-primary' : 'text-light-on-surface-variant'
                }`}
              >
                {msg.time}
              </span>
            </div>
          ))
        )}
      </main>

      <form
        onSubmit={handleSubmit}
        className="p-3 lg:p-4 border-t border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-lowest dark:bg-dark-surface-container-low flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Écrire au Centre de Commandement..."
          className="flex-1 min-h-11 px-3.5 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm focus:border-light-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          aria-label="Envoyer"
          className="w-11 h-11 rounded-md bg-light-primary-container text-light-on-primary-container flex items-center justify-center hover:bg-light-primary shrink-0 disabled:opacity-60"
        >
          <MaterialIcon name="send" className="text-[20px]" />
        </button>
      </form>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Notifications Screen                                                        */
/* -------------------------------------------------------------------------- */
interface NotificationsScreenProps {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onSelectNotification: (n: AppNotification) => void;
  onBack: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  notifications,
  onMarkAllRead,
  onSelectNotification,
  onBack,
}) => {
  return (
    <div className="flex flex-col flex-1">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-4 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-between gap-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Retour"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-light-surface-container-low"
          >
            <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
          </button>
          <h1 className="font-headline text-xl font-bold">Notifications</h1>
        </div>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="text-xs font-semibold text-light-primary-container dark:text-dark-primary hover:underline px-2 py-1"
          >
            Tout marquer lu
          </button>
        )}
      </header>

      <main className="px-4 lg:px-6 py-4 flex flex-col gap-2.5">
        {notifications.length === 0 ? (
          <div className="p-8 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-2">
            <MaterialIcon name="notifications_none" className="text-[32px] text-light-on-surface-variant" />
            <p className="text-sm font-medium">Aucune notification pour le moment</p>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Les mises à jour de vos signalements et plaintes s&apos;afficheront ici.
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelectNotification(n)}
              className={`w-full text-left p-4 rounded-md border transition-colors flex items-start gap-3 ${
                n.read
                  ? 'bg-light-surface-container-lowest dark:bg-dark-surface-container-low border-light-outline-variant dark:border-dark-outline-variant'
                  : 'bg-light-secondary-container/40 dark:bg-dark-secondary-container/40 border-light-primary-container/50'
              }`}
            >
              <span className="w-9 h-9 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center shrink-0">
                <MaterialIcon name="notifications" filled={!n.read} className="text-[18px]" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-headline text-sm font-semibold">{n.title}</h2>
                  <span className="text-[11px] text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums shrink-0">
                    {n.time}
                  </span>
                </div>
                <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-1 leading-relaxed">
                  {n.body}
                </p>
              </div>
            </button>
          ))
        )}
      </main>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Profile & Settings Screen                                                   */
/* -------------------------------------------------------------------------- */
interface ProfileScreenProps {
  user: UserProfile;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSaveProfile: (patch: { fullName?: string; commune?: string; defaultAnonymous?: boolean }) => Promise<void>;
  onNavigate: (screen: ScreenId) => void;
  onLogout: () => void;
  onBack: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  darkMode,
  onToggleDarkMode,
  onSaveProfile,
  onNavigate,
  onLogout,
  onBack,
}) => {
  const [fullName, setFullName] = useState(user.fullName);
  const [commune, setCommune] = useState(user.commune);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    setFullName(user.fullName);
    setCommune(user.commune);
  }, [user.fullName, user.commune]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice('');
    try {
      await onSaveProfile({ fullName: fullName.trim(), commune: commune.trim() });
      setSavedNotice('Profil mis à jour avec succès.');
      window.setTimeout(() => setSavedNotice(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const initials =
    user.fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CI';

  return (
    <div className="flex flex-col flex-1">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-4 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center gap-3 sticky top-0 z-20">
        <button
          type="button"
          aria-label="Retour"
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-light-surface-container-low"
        >
          <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
        </button>
        <h1 className="font-headline text-xl font-bold">Profil &amp; Paramètres</h1>
      </header>

      <main className="px-4 lg:px-6 py-5 flex flex-col gap-5 max-w-2xl">
        <form
          onSubmit={handleSave}
          className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex flex-col gap-4"
        >
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-light-primary-container text-white font-headline text-lg font-bold flex items-center justify-center">
              {initials}
            </span>
            <div>
              <h2 className="font-headline text-base font-bold">{user.fullName || 'Compte citoyen'}</h2>
              <p className="font-mono text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                +243 {user.phone}
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold">Nom complet</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full min-h-11 px-3.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold">Commune de résidence</span>
            <select
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              className="w-full min-h-11 px-3.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm"
            >
              {!KINSHASA_COMMUNES.includes(commune) && commune && (
                <option value={commune}>{commune}</option>
              )}
              {KINSHASA_COMMUNES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-5 rounded-md bg-light-primary-container text-light-on-primary-container font-headline text-sm font-semibold hover:bg-light-primary self-start disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>

          {savedNotice && <p className="text-xs font-semibold text-success">{savedNotice}</p>}
        </form>

        <section className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md divide-y divide-light-outline-variant dark:divide-dark-outline-variant">
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-headline text-sm font-semibold">Mode sombre</p>
              <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Adapter l&apos;affichage en faible luminosité
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={darkMode}
              onClick={onToggleDarkMode}
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                darkMode ? 'bg-light-primary-container' : 'bg-light-outline-variant'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-headline text-sm font-semibold">Anonymat par défaut</p>
              <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Masquer votre identité lors des signalements
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={user.defaultAnonymous}
              onClick={() => {
                void onSaveProfile({ defaultAnonymous: !user.defaultAnonymous });
              }}
              className={`w-12 h-7 rounded-full p-1 transition-colors ${
                user.defaultAnonymous ? 'bg-light-primary-container' : 'bg-light-outline-variant'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                  user.defaultAnonymous ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('doc-verification')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
          >
            <span className="font-headline text-sm font-semibold">Vérifier un document officiel</span>
            <MaterialIcon name="chevron_right" className="text-light-on-surface-variant" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('complaints-history')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
          >
            <span className="font-headline text-sm font-semibold">Historique des plaintes</span>
            <MaterialIcon name="chevron_right" className="text-light-on-surface-variant" />
          </button>
        </section>

        <button
          type="button"
          onClick={onLogout}
          className="min-h-[46px] px-5 rounded-md border border-sos-red text-sos-red font-headline text-sm font-semibold hover:bg-sos-container/40 transition-colors flex items-center justify-center gap-2 self-start"
        >
          <MaterialIcon name="logout" className="text-[18px]" />
          <span>Se déconnecter</span>
        </button>
      </main>
    </div>
  );
};
