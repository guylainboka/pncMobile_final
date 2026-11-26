import React from 'react';
import { ASSETS } from '../data/mockData';
import { ScreenId } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface AppShellProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  showBottomNav?: boolean;
  unreadNotifications: number;
  children: React.ReactNode;
}

const SIDEBAR_ITEMS: { id: ScreenId; label: string; icon: string; section: 'main' | 'services' }[] = [
  { id: 'dashboard', label: 'Accueil', icon: 'home', section: 'main' },
  { id: 'report-step1', label: 'Signaler un incident', icon: 'report', section: 'main' },
  { id: 'my-alerts', label: 'Mes alertes', icon: 'notifications', section: 'main' },
  { id: 'official-alerts', label: 'Alertes officielles', icon: 'campaign', section: 'main' },
  { id: 'incident-map', label: 'Carte de sécurité', icon: 'map', section: 'services' },
  { id: 'police-stations', label: 'Postes de police', icon: 'location_on', section: 'services' },
  { id: 'file-complaint', label: 'Déposer une plainte', icon: 'description', section: 'services' },
  { id: 'complaints-history', label: 'Mes plaintes', icon: 'folder_open', section: 'services' },
  { id: 'doc-verification', label: 'Vérification doc.', icon: 'qr_code_scanner', section: 'services' },
  { id: 'prevention-center', label: 'Conseils sécurité', icon: 'shield', section: 'services' },
  { id: 'emergency-directory', label: "Annuaire d'urgence", icon: 'call', section: 'services' },
  { id: 'profile', label: 'Profil & Paramètres', icon: 'person', section: 'services' },
];

export const AppShell: React.FC<AppShellProps> = ({
  currentScreen,
  onNavigate,
  showBottomNav = true,
  unreadNotifications,
  children,
}) => {
  const isActiveTab = (tab: 'accueil' | 'signalement' | 'alertes' | 'conseils' | 'profil') => {
    if (tab === 'accueil') return currentScreen === 'dashboard';
    if (tab === 'signalement')
      return (
        currentScreen === 'report-step1' ||
        currentScreen === 'report-step2' ||
        currentScreen === 'report-step3'
      );
    if (tab === 'alertes')
      return (
        currentScreen === 'my-alerts' ||
        currentScreen === 'official-alerts' ||
        currentScreen === 'complaints-history' ||
        currentScreen === 'live-tracking'
      );
    if (tab === 'conseils')
      return currentScreen === 'prevention-center' || currentScreen === 'emergency-directory';
    if (tab === 'profil') return currentScreen === 'profile';
    return false;
  };

  return (
    <div className="min-h-screen w-full bg-light-surface-container-low dark:bg-dark-background text-light-on-surface dark:text-dark-on-surface flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside
        aria-label="Navigation latérale"
        className="hidden lg:flex lg:flex-col lg:w-68 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest border-r border-light-outline-variant dark:border-dark-outline-variant justify-between p-5"
      >
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          {/* Brand Header */}
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-3 text-left group focus-visible:outline-2 focus-visible:outline-light-primary rounded-md p-1"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-navy shrink-0 flex items-center justify-center border border-light-outline-variant p-1">
              <img
                src={ASSETS.pncCrest}
                alt="Emblème PNC Alerte"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="font-headline text-[18px] font-bold text-light-primary dark:text-dark-primary block leading-tight whitespace-nowrap">
                PNC Alerte
              </span>
              <span className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant block truncate">
                Police Nationale Congolaise
              </span>
            </div>
          </button>

          {/* SOS Shortcut */}
          <button
            type="button"
            onClick={() => onNavigate('sos-alert')}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-md bg-sos-red text-on-sos-red font-headline font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-700 active:scale-[0.98] transition-all shadow-sm"
          >
            <MaterialIcon name="emergency_share" filled className="text-[20px]" />
            <span>SOS Urgence</span>
          </button>

          {/* Primary Navigation */}
          <nav className="flex flex-col gap-1" aria-label="Menu principal">
            <p className="px-3 pb-1 text-[11px] font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant tracking-wide">
              Principal
            </p>
            {SIDEBAR_ITEMS.filter((i) => i.section === 'main').map((item) => {
              const active =
                currentScreen === item.id ||
                (item.id === 'report-step1' &&
                  ['report-step1', 'report-step2', 'report-step3'].includes(currentScreen)) ||
                (item.id === 'my-alerts' && currentScreen === 'live-tracking');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full min-h-[42px] px-3 py-2 rounded-md flex items-center gap-3 text-sm font-medium transition-colors text-left ${
                    active
                      ? 'bg-light-secondary-container dark:bg-dark-secondary-container text-light-on-secondary-container dark:text-dark-on-secondary-container font-semibold'
                      : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low hover:text-light-on-surface dark:hover:text-dark-on-surface'
                  }`}
                >
                  <MaterialIcon name={item.icon} filled={active} className="text-[20px] shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Services Navigation */}
          <nav className="flex flex-col gap-1" aria-label="Services citoyens">
            <p className="px-3 pb-1 text-[11px] font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant tracking-wide">
              Services &amp; Outils
            </p>
            {SIDEBAR_ITEMS.filter((i) => i.section === 'services').map((item) => {
              const active = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-md flex items-center gap-3 text-sm font-medium transition-colors text-left ${
                    active
                      ? 'bg-light-secondary-container dark:bg-dark-secondary-container text-light-on-secondary-container dark:text-dark-on-secondary-container font-semibold'
                      : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low hover:text-light-on-surface dark:hover:text-dark-on-surface'
                  }`}
                >
                  <MaterialIcon name={item.icon} filled={active} className="text-[20px] shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Notifications Quick Access */}
        <div className="pt-4 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className={`w-full min-h-[42px] px-3 py-2 rounded-md flex items-center justify-between text-sm font-medium transition-colors ${
              currentScreen === 'notifications'
                ? 'bg-light-secondary-container dark:bg-dark-secondary-container text-light-on-secondary-container dark:text-dark-on-secondary-container'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low'
            }`}
          >
            <span className="flex items-center gap-3">
              <MaterialIcon name="mark_email_unread" className="text-[20px]" />
              <span>Notifications</span>
            </span>
            {unreadNotifications > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-sos-red text-on-sos-red tabular-nums">
                {unreadNotifications}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <div
          className={`flex-1 w-full max-w-[430px] lg:max-w-5xl mx-auto flex flex-col ${
            showBottomNav ? 'pb-20 lg:pb-8' : 'pb-6 lg:pb-8'
          }`}
        >
          {children}
        </div>
      </div>

      {/* Mobile Fixed Bottom Navigation (matches Stitch 5-tab bar) */}
      {showBottomNav && (
        <nav
          aria-label="Navigation principale"
          className="lg:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-light-surface-container-lowest/95 dark:bg-dark-surface-container-lowest/95 backdrop-blur-md border-t border-light-outline-variant dark:border-dark-outline-variant px-2 py-1.5 grid grid-cols-5 items-center z-40"
        >
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActiveTab('accueil')
                ? 'text-light-primary-container dark:text-dark-primary'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <MaterialIcon name="home" filled={isActiveTab('accueil')} className="text-[22px]" />
            <span className="font-label text-[11px] font-semibold whitespace-nowrap">Accueil</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('report-step1')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActiveTab('signalement')
                ? 'text-light-primary-container dark:text-dark-primary'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <MaterialIcon name="report" filled={isActiveTab('signalement')} className="text-[22px]" />
            <span className="font-label text-[11px] font-semibold whitespace-nowrap">Signalement</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('my-alerts')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActiveTab('alertes')
                ? 'text-light-primary-container dark:text-dark-primary'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <MaterialIcon name="notifications" filled={isActiveTab('alertes')} className="text-[22px]" />
            <span className="font-label text-[11px] font-semibold whitespace-nowrap">Mes alertes</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('prevention-center')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActiveTab('conseils')
                ? 'text-light-primary-container dark:text-dark-primary'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <MaterialIcon name="shield" filled={isActiveTab('conseils')} className="text-[22px]" />
            <span className="font-label text-[11px] font-semibold whitespace-nowrap">Conseils</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('profile')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActiveTab('profil')
                ? 'text-light-primary-container dark:text-dark-primary'
                : 'text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface'
            }`}
          >
            <MaterialIcon name="person" filled={isActiveTab('profil')} className="text-[22px]" />
            <span className="font-label text-[11px] font-semibold whitespace-nowrap">Profil</span>
          </button>
        </nav>
      )}
    </div>
  );
};
