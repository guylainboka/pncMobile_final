import React, { useEffect, useState } from 'react';
import { PoliceStation } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface PoliceStationsScreenProps {
  stations: PoliceStation[];
  onToggleFavorite: (stationId: string) => void;
  onBack: () => void;
  onViewMap: (commune?: string) => void;
}

type StationFilter = 'proches' | 'tous' | 'favoris';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const PoliceStationsScreen: React.FC<PoliceStationsScreenProps> = ({
  stations,
  onToggleFavorite,
  onBack,
  onViewMap,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StationFilter>('tous');
  const [selectedStation, setSelectedStation] = useState<PoliceStation | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setFilter('proches');
      },
      () => {
        // Keep default ordering when location permission is denied or unavailable
      },
      { timeout: 4000 }
    );
  }, []);

  const getDistanceKm = (st: PoliceStation): number | null => {
    if (!userCoords || typeof st.latitude !== 'number' || typeof st.longitude !== 'number') {
      return null;
    }
    return haversineKm(userCoords.lat, userCoords.lng, st.latitude, st.longitude);
  };

  const filteredStations = stations
    .filter((st) => {
      if (filter === 'favoris' && !st.isFavorite) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        st.name.toLowerCase().includes(q) ||
        st.address.toLowerCase().includes(q) ||
        st.commune.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (filter !== 'proches') return a.name.localeCompare(b.name);
      const da = getDistanceKm(a);
      const db = getDistanceKm(b);
      if (da !== null && db !== null) return da - db;
      return a.name.localeCompare(b.name);
    });

  const handleCopyPhone = async (id: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="flex flex-col flex-1 justify-between min-h-screen lg:min-h-0">
      <div>
        <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-3 border-b border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-3 sticky top-0 z-20">
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
              Postes de police
            </h1>
          </div>

          <label className="relative flex items-center">
            <MaterialIcon
              name="search"
              className="text-[20px] text-light-on-surface-variant dark:text-dark-on-surface-variant absolute left-3"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un poste ou une commune"
              className="w-full min-h-11 pl-10 pr-3.5 py-2 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
            />
          </label>

          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Filtrer les postes">
            {[
              { id: 'proches' as StationFilter, label: 'Proches' },
              { id: 'tous' as StationFilter, label: 'Tous' },
              { id: 'favoris' as StationFilter, label: 'Favoris' },
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
          {filteredStations.length === 0 ? (
            <div className="p-8 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-2">
              <MaterialIcon name="location_off" className="text-[32px] text-light-on-surface-variant" />
              <p className="text-sm font-medium text-light-on-surface dark:text-dark-on-surface">
                {stations.length === 0
                  ? 'Aucun commissariat enregistré pour le moment'
                  : 'Aucun poste trouvé'}
              </p>
              <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {stations.length === 0
                  ? 'Les commissariats synchronisés depuis le Centre de Commandement apparaîtront ici.'
                  : 'Essayez une autre commune ou consultez tous les commissariats.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredStations.map((st) => {
                const distKm = getDistanceKm(st);
                return (
                  <article
                    key={st.id}
                    className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3.5 flex items-center gap-3 hover:border-light-primary transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStation(st)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                    >
                      <span className="w-10 h-10 rounded-full bg-light-secondary-container text-light-primary flex items-center justify-center shrink-0">
                        <MaterialIcon name="location_on" filled className="text-[20px]" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <h2 className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface truncate">
                          {st.name}
                        </h2>
                        <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant truncate">
                          {st.address}
                        </p>
                        <span className="font-label text-xs font-semibold text-light-primary-container dark:text-dark-primary tabular-nums">
                          {distKm !== null ? `${distKm.toFixed(1)} km · ` : ''}
                          {st.commune}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      aria-label={st.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                      onClick={() => onToggleFavorite(st.id)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                        st.isFavorite
                          ? 'text-warning hover:bg-warning-container/40'
                          : 'text-light-on-surface-variant hover:bg-light-surface-container-low'
                      }`}
                    >
                      <MaterialIcon name="star" filled={Boolean(st.isFavorite)} className="text-[20px]" />
                    </button>

                    <button
                      type="button"
                      aria-label={`Détails ${st.name}`}
                      onClick={() => setSelectedStation(st)}
                      className="w-8 h-10 flex items-center justify-center text-light-on-surface-variant"
                    >
                      <MaterialIcon name="chevron_right" className="text-[20px]" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <footer className="px-4 lg:px-6 py-5">
        <button
          type="button"
          onClick={() => onViewMap()}
          className="w-full lg:max-w-xs min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center gap-2"
        >
          <MaterialIcon name="map" className="text-[20px]" />
          <span>Voir sur la carte</span>
        </button>
      </footer>

      {selectedStation && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedStation(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-light-primary-container dark:text-dark-primary tabular-nums">
                  Commune de {selectedStation.commune}
                  {(() => {
                    const d = getDistanceKm(selectedStation);
                    return d !== null ? ` · ${d.toFixed(1)} km` : '';
                  })()}
                </p>
                <h2 className="font-headline text-lg font-bold mt-0.5">{selectedStation.name}</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setSelectedStation(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-light-surface-container-low"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              <div className="flex items-center gap-2.5">
                <MaterialIcon name="location_on" className="text-light-primary shrink-0" />
                <span>{selectedStation.address}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <MaterialIcon name="schedule" className="text-light-primary shrink-0" />
                <span>{selectedStation.hours}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <MaterialIcon name="call" className="text-light-primary shrink-0" />
                  <span className="font-mono tabular-nums">{selectedStation.phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPhone(selectedStation.id, selectedStation.phone)}
                  className="text-xs font-semibold text-light-primary hover:underline"
                >
                  {copiedId === selectedStation.id ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <a
                href={`tel:${selectedStation.phone.replace(/\s+/g, '')}`}
                className="min-h-[44px] px-4 py-2.5 rounded-md border border-light-outline-variant font-headline text-sm font-semibold flex items-center justify-center gap-2 hover:bg-light-surface-container-low"
              >
                <MaterialIcon name="call" className="text-[18px]" />
                <span>Appeler</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  const commune = selectedStation.commune;
                  setSelectedStation(null);
                  onViewMap(commune);
                }}
                className="min-h-[44px] px-4 py-2.5 rounded-md bg-light-primary-container text-light-on-primary-container font-headline text-sm font-semibold flex items-center justify-center gap-2 hover:bg-light-primary"
              >
                <MaterialIcon name="directions" className="text-[18px]" />
                <span>Localiser</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
