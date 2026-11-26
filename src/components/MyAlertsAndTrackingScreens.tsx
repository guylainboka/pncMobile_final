import React, { useState } from 'react';
import { REPORT_STATUS_ORDER } from '../data/mockData';
import { IncidentReport, ReportStatus } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface MyAlertsScreenProps {
  reports: IncidentReport[];
  onBack: () => void;
  onSelectReport: (reportId: string) => void;
  onNewReport: () => void;
}

export const MyAlertsScreen: React.FC<MyAlertsScreenProps> = ({
  reports,
  onBack,
  onSelectReport,
  onNewReport,
}) => {
  const [filter, setFilter] = useState<'all' | 'encours' | 'cloturee'>('all');

  const visibleReports =
    filter === 'all' ? reports : reports.filter((r) => r.filterKey === filter);

  const getStatusClass = (status: ReportStatus) => {
    switch (status) {
      case 'Nouvelle':
        return 'bg-sos-container text-on-sos-container';
      case 'En vérification':
        return 'bg-warning-container text-on-warning-container';
      case 'Confirmée':
        return 'bg-info-container text-on-info-container';
      case 'Affectée à une équipe':
      case 'Intervention en cours':
        return 'bg-light-secondary-container text-light-on-secondary-container';
      case 'Résolue':
      case 'Clôturée':
        return 'bg-success-container text-on-success-container';
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-3 border-b border-light-outline-variant dark:border-dark-outline-variant sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Retour"
              onClick={onBack}
              className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
            >
              <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
            </button>
            <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
              Mes alertes
            </h1>
          </div>
          <button
            type="button"
            onClick={onNewReport}
            className="min-h-[38px] px-3.5 py-1.5 rounded-md bg-light-primary-container text-light-on-primary-container font-label text-xs font-semibold hover:bg-light-primary transition-colors flex items-center gap-1.5"
          >
            <MaterialIcon name="add" className="text-[16px]" />
            <span>Signaler</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Filtrer mes alertes">
          {[
            { id: 'all' as const, label: 'Toutes' },
            { id: 'encours' as const, label: 'En cours' },
            { id: 'cloturee' as const, label: 'Clôturées' },
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] py-1.5 rounded-full font-label text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-light-primary-container text-light-on-primary-container'
                    : 'bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface-variant dark:text-dark-on-surface-variant'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="px-4 lg:px-6 py-4 flex flex-col gap-3">
        {visibleReports.length === 0 ? (
          <div className="p-8 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-3">
            <MaterialIcon name="notifications_off" className="text-[32px] text-light-on-surface-variant" />
            <p className="text-sm font-medium">
              {reports.length === 0
                ? 'Vous n’avez pas encore envoyé de signalement'
                : 'Aucun signalement dans cette catégorie'}
            </p>
            <button
              type="button"
              onClick={onNewReport}
              className="min-h-[40px] px-4 rounded-md bg-light-primary-container text-light-on-primary-container text-xs font-semibold"
            >
              Signaler un incident
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleReports.map((rep) => (
              <article
                key={rep.id}
                onClick={() => onSelectReport(rep.id)}
                className="cursor-pointer bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex flex-col gap-2 hover:border-light-primary dark:hover:border-dark-primary transition-colors"
              >
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-mono text-[13px] font-semibold text-light-on-surface dark:text-dark-on-surface tabular-nums">
                      {rep.reference}
                    </h2>
                    <p className="font-body text-sm font-medium text-light-on-surface dark:text-dark-on-surface">
                      {rep.category}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-label text-[11px] font-semibold shrink-0 ${getStatusClass(
                      rep.status
                    )}`}
                  >
                    {rep.status}
                  </span>
                </header>
                <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant line-clamp-2">
                  {rep.description}
                </p>
                <div className="flex items-center justify-between pt-1 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  <span>{rep.location}</span>
                  <span className="tabular-nums">{rep.timestamp}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

interface LiveTrackingScreenProps {
  report: IncidentReport;
  onBack: () => void;
  onContactDispatch: () => void;
}

export const LiveTrackingScreen: React.FC<LiveTrackingScreenProps> = ({
  report,
  onBack,
  onContactDispatch,
}) => {
  const currentStepIndex = REPORT_STATUS_ORDER.indexOf(report.status);
  const isAssigned = Boolean(report.patrolUnit) && currentStepIndex >= 3;

  return (
    <div className="flex flex-col flex-1 justify-between min-h-screen lg:min-h-0">
      <div>
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
            Suivi du signalement
          </h1>
        </header>

        <main className="px-4 lg:px-6 py-4 flex flex-col gap-4">
          <section className="flex flex-col gap-0.5">
            <h2 className="font-mono text-[13px] font-semibold text-light-on-surface dark:text-dark-on-surface tabular-nums">
              {report.reference}
            </h2>
            <p className="font-body text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
              {report.category}
            </p>
            <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {report.location} {report.anonymous ? '· Envoi anonyme' : ''}
            </p>
            {typeof report.latitude === 'number' && typeof report.longitude === 'number' && (
              <p className="font-mono text-[11px] text-light-on-surface-variant tabular-nums">
                GPS : {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </p>
            )}
          </section>

          <article className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center shrink-0">
              <MaterialIcon name="local_police" filled className="text-[24px]" />
            </span>
            <div>
              <h3 className="font-headline text-base font-semibold text-light-on-surface dark:text-dark-on-surface">
                {report.status}
              </h3>
              <p className="font-body text-xs text-light-primary-container dark:text-dark-primary font-semibold tabular-nums mt-0.5">
                {report.status === 'Clôturée' || report.status === 'Résolue'
                  ? 'Dossier traité et clôturé'
                  : isAssigned
                  ? `${report.patrolUnit}${
                      report.etaMinutes ? ` · Arrivée estimée : ${report.etaMinutes} min` : ''
                    }`
                  : 'Transmis au Centre de Commandement PNC en attente de validation'}
              </p>
              {report.validatedBy && (
                <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
                  Validé par : {report.validatedBy}
                </p>
              )}
              {report.validationNotes && (
                <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant mt-0.5">
                  Note : {report.validationNotes}
                </p>
              )}
            </div>
          </article>

          {/* 7-Step Lifecycle Progress */}
          <section className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4">
            <h3 className="font-headline text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant mb-3">
              Chaîne de coordination PNC
            </h3>
            <div className="flex flex-col gap-2">
              {REPORT_STATUS_ORDER.map((step, idx) => {
                const done = idx <= currentStepIndex;
                return (
                  <div key={step} className="flex items-center gap-2.5 text-xs">
                    <MaterialIcon
                      name={done ? 'check_circle' : 'radio_button_unchecked'}
                      filled={done}
                      className={`text-[18px] shrink-0 ${
                        done ? 'text-success' : 'text-light-outline-variant'
                      }`}
                    />
                    <span
                      className={
                        done
                          ? 'font-semibold text-light-on-surface dark:text-dark-on-surface'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4">
            <p className="text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant mb-1">
              Détails du signalement
            </p>
            <p className="text-sm text-light-on-surface dark:text-dark-on-surface leading-relaxed">
              {report.description}
            </p>
          </div>
        </main>
      </div>

      <footer className="px-4 lg:px-6 py-5">
        <button
          type="button"
          onClick={onContactDispatch}
          className="w-full lg:max-w-xs min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center gap-2"
        >
          <MaterialIcon name="chat" className="text-[20px]" />
          <span>Contacter le dispatching</span>
        </button>
      </footer>
    </div>
  );
};
