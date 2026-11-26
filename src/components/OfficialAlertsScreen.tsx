import React, { useState } from 'react';
import { OfficialAlert, OfficialAlertCategory, ScreenId } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface OfficialAlertsScreenProps {
  alerts: OfficialAlert[];
  onBack: () => void;
  onNavigate: (screen: ScreenId) => void;
}

const FILTER_TABS: { id: 'all' | OfficialAlertCategory; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'avis', label: 'Avis de recherche' },
  { id: 'info', label: 'Info' },
];

export const OfficialAlertsScreen: React.FC<OfficialAlertsScreenProps> = ({
  alerts,
  onBack,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'all' | OfficialAlertCategory>('all');
  const [selectedAlert, setSelectedAlert] = useState<OfficialAlert | null>(null);

  const visibleAlerts =
    filter === 'all' ? alerts : alerts.filter((a) => a.category === filter);

  const getCategoryStyle = (cat: OfficialAlertCategory) => {
    if (cat === 'securite') {
      return {
        iconWrap: 'bg-sos-container text-sos-red',
        badge: 'bg-sos-container text-on-sos-container',
      };
    }
    if (cat === 'avis') {
      return {
        iconWrap: 'bg-warning-container text-warning',
        badge: 'bg-warning-container text-on-warning-container',
      };
    }
    return {
      iconWrap: 'bg-info-container text-info',
      badge: 'bg-info-container text-on-info-container',
    };
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-3 border-b border-light-outline-variant dark:border-dark-outline-variant sticky top-0 z-20">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            aria-label="Retour"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
          >
            <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
          </button>
          <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
            Alertes officielles
          </h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrer les alertes">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] px-3.5 py-1.5 rounded-full font-label text-xs font-semibold shrink-0 whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-light-primary-container text-light-on-primary-container'
                    : 'bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface-variant dark:text-dark-on-surface-variant hover:bg-light-surface-container-high'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 lg:px-6 py-4 flex flex-col gap-3">
        {visibleAlerts.length === 0 ? (
          <div className="p-8 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-2">
            <MaterialIcon name="campaign" className="text-[32px] text-light-on-surface-variant" />
            <p className="text-sm font-medium text-light-on-surface dark:text-dark-on-surface">
              Aucune alerte officielle pour le moment
            </p>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Les alertes diffusées par le Centre de Commandement PNC apparaîtront ici en temps réel.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleAlerts.map((alert) => {
              const style = getCategoryStyle(alert.category);
              return (
                <article
                  key={alert.id}
                  onClick={() => setSelectedAlert(alert)}
                  className="cursor-pointer bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3.5 flex items-start gap-3 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
                >
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${style.iconWrap}`}
                  >
                    <MaterialIcon name={alert.icon} filled className="text-[20px]" />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                        {alert.title}
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-full font-label text-[11px] font-semibold shrink-0 ${style.badge}`}
                      >
                        {alert.categoryLabel}
                      </span>
                    </div>
                    <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant leading-relaxed">
                      {alert.summary}
                    </p>
                    <div className="flex items-center justify-between pt-0.5 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                      <span>{alert.location}</span>
                      <span className="tabular-nums">{alert.timeAgo}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {selectedAlert && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedAlert(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-light-primary-container dark:text-dark-primary">
                  {selectedAlert.categoryLabel} · {selectedAlert.timeAgo}
                </p>
                <h2 className="font-headline text-lg font-bold text-light-on-surface dark:text-dark-on-surface mt-0.5">
                  {selectedAlert.title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setSelectedAlert(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-light-surface-container-low"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <p className="text-sm text-light-on-surface dark:text-dark-on-surface leading-relaxed">
              {selectedAlert.fullDetails}
            </p>

            <div className="p-3 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container flex items-center gap-2 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              <MaterialIcon name="location_on" className="text-[18px] text-light-primary" />
              <span>Zone concernée : {selectedAlert.location}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedAlert(null);
                  onNavigate('incident-map');
                }}
                className="min-h-[44px] px-4 py-2.5 rounded-md border border-light-outline-variant dark:border-dark-outline-variant font-headline text-sm font-semibold hover:bg-light-surface-container-low transition-colors"
              >
                Voir sur la carte
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAlert(null);
                  onNavigate('report-step1');
                }}
                className="min-h-[44px] px-4 py-2.5 rounded-md bg-light-primary-container text-light-on-primary-container font-headline text-sm font-semibold hover:bg-light-primary transition-colors"
              >
                Signaler un fait
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
