import React, { useState } from 'react';
import { IncidentReport, OfficialAlert, ScreenId, UserProfile } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface DashboardScreenProps {
  user: UserProfile;
  officialAlerts: OfficialAlert[];
  userReports: IncidentReport[];
  unreadNotifications: number;
  onNavigate: (screen: ScreenId) => void;
  onSelectReport: (reportId: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  officialAlerts,
  userReports,
  unreadNotifications,
  onNavigate,
  onSelectReport,
}) => {
  const [moreServicesOpen, setMoreServicesOpen] = useState(false);
  const firstName = user.fullName.trim().split(' ')[0] || 'Citoyen';
  const activeReport = userReports.find((r) =>
    ['Nouvelle', 'En vérification', 'Confirmée', 'Affectée à une équipe', 'Intervention en cours'].includes(
      r.status
    )
  );

  return (
    <div className="flex flex-col gap-5 lg:p-6">
      {/* Top Blue Hero Header */}
      <header className="bg-light-primary-container text-light-on-primary-container px-4 lg:px-6 pt-6 pb-8 rounded-b-xl lg:rounded-xl">
        <div className="flex items-start justify-between gap-2 mb-5">
          <div>
            <h1 className="font-headline text-xl lg:text-2xl font-bold text-light-on-primary-container">
              Bonjour, {firstName}
            </h1>
            <p className="font-body text-xs lg:text-sm text-light-inverse-primary">
              Que pouvons-nous faire aujourd&apos;hui ?
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => onNavigate('notifications')}
              className="w-10 h-10 rounded-full bg-light-primary flex items-center justify-center text-light-on-primary relative hover:bg-brand-navy transition-colors"
            >
              <MaterialIcon name="notifications" className="text-[20px]" />
              {unreadNotifications > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-sos-red text-on-sos-red text-[10px] font-bold flex items-center justify-center absolute -top-0.5 -right-0.5 tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Paramètres du compte"
              onClick={() => onNavigate('profile')}
              className="w-10 h-10 rounded-full bg-light-primary flex items-center justify-center text-light-on-primary hover:bg-brand-navy transition-colors"
            >
              <MaterialIcon name="person" className="text-[20px]" />
            </button>
          </div>
        </div>

        {/* SOS Card + Active Intervention Banner on Desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <section className="lg:col-span-5 bg-sos-red text-on-sos-red rounded-lg p-5 flex flex-col items-center text-center gap-3 shadow-md">
            <p className="font-label text-xs font-semibold text-on-sos-red">
              Appuyez en cas d&apos;urgence
            </p>
            <button
              type="button"
              onClick={() => onNavigate('sos-alert')}
              className="w-28 h-28 rounded-full bg-light-surface-container-lowest text-sos-red border-4 border-sos-container shadow-lg flex flex-col items-center justify-center hover:scale-[1.03] active:scale-[0.97] transition-transform"
            >
              <span className="font-display text-2xl font-bold text-sos-red leading-none">SOS</span>
              <span className="font-label text-[11px] font-semibold text-sos-red tracking-wider mt-1">
                URGENCE
              </span>
            </button>
          </section>

          {/* Desktop Quick Status Summary */}
          <div className="hidden lg:flex lg:col-span-7 flex-col justify-between bg-light-primary/60 border border-light-inverse-primary/20 rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-light-inverse-primary">
                  Secteur actuel
                </p>
                <p className="font-headline text-lg font-bold text-white mt-0.5">
                  {user.commune}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('incident-map')}
                className="px-3.5 py-2 rounded-md bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <MaterialIcon name="map" className="text-[16px]" />
                <span>Carte de sécurité</span>
              </button>
            </div>

            {activeReport ? (
              <button
                type="button"
                onClick={() => onSelectReport(activeReport.id)}
                className="mt-4 w-full bg-white text-light-on-surface rounded-md p-3.5 flex items-center justify-between gap-3 hover:bg-light-surface-container-low transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-warning-container text-warning flex items-center justify-center shrink-0">
                    <MaterialIcon name="local_police" filled className="text-[20px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-light-primary-container tabular-nums">
                      {activeReport.reference} · {activeReport.status}
                    </p>
                    <p className="text-sm font-semibold text-light-on-surface truncate">
                      {activeReport.category} —{' '}
                      {activeReport.patrolUnit
                        ? `${activeReport.patrolUnit} (${activeReport.etaMinutes ?? 6} min)`
                        : 'En attente de validation par un opérateur PNC'}
                    </p>
                  </div>
                </div>
                <MaterialIcon name="chevron_right" className="text-light-on-surface-variant shrink-0" />
              </button>
            ) : (
              <div className="mt-4 bg-white/10 rounded-md p-3.5 flex items-center justify-between gap-3">
                <p className="text-sm text-light-inverse-primary">
                  Aucune intervention active en cours sur votre compte.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('file-complaint')}
                  className="px-3 py-1.5 rounded-md bg-white text-light-primary text-xs font-semibold whitespace-nowrap"
                >
                  Déposer plainte
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Services Grid */}
      <main className="px-4 lg:px-0 -mt-9 lg:mt-0 flex flex-col gap-6">
        <section aria-label="Services rapides" className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 lg:gap-3">
          <button
            type="button"
            onClick={() => onNavigate('report-step1')}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3 lg:p-4 flex flex-col items-center text-center gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-sos-container text-sos-red flex items-center justify-center">
              <MaterialIcon name="warning" filled className="text-[20px]" />
            </span>
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface leading-tight">
              Signaler un incident
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('my-alerts')}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3 lg:p-4 flex flex-col items-center text-center gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center">
              <MaterialIcon name="notifications" filled className="text-[20px]" />
            </span>
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface leading-tight">
              Mes alertes
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('prevention-center')}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3 lg:p-4 flex flex-col items-center text-center gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center">
              <MaterialIcon name="shield" filled className="text-[20px]" />
            </span>
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface leading-tight">
              Conseils de sécurité
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('police-stations')}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3 lg:p-4 flex flex-col items-center text-center gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center">
              <MaterialIcon name="location_on" filled className="text-[20px]" />
            </span>
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface leading-tight">
              Postes de police
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('emergency-directory')}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3 lg:p-4 flex flex-col items-center text-center gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center">
              <MaterialIcon name="call" filled className="text-[20px]" />
            </span>
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface leading-tight">
              Annuaire d&apos;urgence
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMoreServicesOpen(true)}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3 lg:p-4 flex flex-col items-center text-center gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface dark:text-dark-on-surface flex items-center justify-center">
              <MaterialIcon name="grid_view" className="text-[20px]" />
            </span>
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface leading-tight">
              Plus de services
            </span>
          </button>
        </section>

        {/* Recent Alerts */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-base font-semibold text-light-on-surface dark:text-dark-on-surface">
              Alertes récentes
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('official-alerts')}
              className="font-label text-xs font-semibold text-light-primary-container dark:text-dark-primary hover:underline px-2 py-1"
            >
              Voir tout
            </button>
          </div>

          {officialAlerts.length === 0 ? (
            <div className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex items-center gap-3 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              <MaterialIcon name="campaign" className="text-[20px] text-light-primary shrink-0" />
              <span>Aucune alerte officielle publiée par le Centre de Commandement pour le moment.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {officialAlerts.slice(0, 2).map((alert, idx) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onNavigate('official-alerts')}
                  className={`${
                    idx === 1 ? 'hidden lg:flex' : 'flex'
                  } w-full bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3.5 items-center gap-3 hover:border-light-primary dark:hover:border-dark-primary transition-colors text-left`}
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      alert.category === 'securite'
                        ? 'bg-sos-container text-sos-red'
                        : alert.category === 'avis'
                        ? 'bg-warning-container text-warning'
                        : 'bg-info-container text-info'
                    }`}
                  >
                    <MaterialIcon name={alert.icon} filled className="text-[20px]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface truncate">
                      {alert.title}
                    </h3>
                    <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant truncate">
                      {alert.location} · {alert.summary}
                    </p>
                    <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                      {alert.timeAgo}
                    </p>
                  </div>
                  <MaterialIcon
                    name="chevron_right"
                    className="text-light-on-surface-variant dark:text-dark-on-surface-variant text-[20px] shrink-0"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Mobile Quick Access to Plaintes & Carte */}
        <section className="lg:hidden grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('file-complaint')}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3.5 flex items-center gap-3 text-left hover:border-light-primary transition-colors"
          >
            <span className="w-9 h-9 rounded-md bg-light-secondary-container text-light-primary flex items-center justify-center shrink-0">
              <MaterialIcon name="description" className="text-[18px]" />
            </span>
            <span className="font-label text-xs font-semibold leading-tight">
              Déposer une plainte
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('incident-map')}
            className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3.5 flex items-center gap-3 text-left hover:border-light-primary transition-colors"
          >
            <span className="w-9 h-9 rounded-md bg-info-container text-info flex items-center justify-center shrink-0">
              <MaterialIcon name="map" className="text-[18px]" />
            </span>
            <span className="font-label text-xs font-semibold leading-tight">
              Carte des incidents
            </span>
          </button>
        </section>
      </main>

      {/* "Plus de services" Bottom Sheet / Modal */}
      {moreServicesOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setMoreServicesOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[430px] rounded-t-3xl sm:rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-4 shadow-xl"
          >
            <div className="w-10 h-1.5 bg-light-outline-variant dark:bg-dark-outline-variant rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold text-light-on-surface dark:text-dark-on-surface">
                Tous les services PNC
              </h2>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setMoreServicesOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {[
                {
                  id: 'file-complaint' as ScreenId,
                  icon: 'description',
                  title: 'Déposer plainte en ligne',
                  sub: 'Vol, escroquerie, perte de document',
                  tone: 'bg-light-secondary-container text-light-primary',
                },
                {
                  id: 'complaints-history' as ScreenId,
                  icon: 'folder_open',
                  title: 'Historique des plaintes',
                  sub: 'Suivre le statut auprès du commissariat',
                  tone: 'bg-success-container text-on-success-container',
                },
                {
                  id: 'incident-map' as ScreenId,
                  icon: 'map',
                  title: 'Carte de sécurité',
                  sub: 'Incidents récents et postes à Kinshasa',
                  tone: 'bg-info-container text-info',
                },
                {
                  id: 'doc-verification' as ScreenId,
                  icon: 'qr_code_scanner',
                  title: 'Vérification documentaire',
                  sub: 'Scanner un QR code ou vérifier un récépissé',
                  tone: 'bg-warning-container text-warning',
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMoreServicesOpen(false);
                    onNavigate(item.id);
                  }}
                  className="w-full p-3.5 rounded-md border border-light-outline-variant dark:border-dark-outline-variant flex items-center gap-3.5 hover:border-light-primary text-left transition-colors"
                >
                  <span className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${item.tone}`}>
                    <MaterialIcon name={item.icon} className="text-[20px]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                      {item.title}
                    </p>
                    <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant truncate">
                      {item.sub}
                    </p>
                  </div>
                  <MaterialIcon name="chevron_right" className="text-light-on-surface-variant" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
