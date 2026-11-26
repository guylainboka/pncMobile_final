import React, { useMemo, useState } from 'react';
import { PoliceStation, PublicMapIncident } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface IncidentMapScreenProps {
  incidents: PublicMapIncident[];
  stations: PoliceStation[];
  onBack: () => void;
  initialFocusDistrict?: string;
}

type MapPinFilter = 'all' | 'braquage' | 'accident' | 'incident' | 'poste';

interface ComputedPin {
  id: string;
  kind: 'braquage' | 'accident' | 'incident' | 'poste';
  label: string;
  subtitle: string;
  district: string;
  description: string;
  topPercent: number;
  leftPercent: number;
}

function projectKinshasaCoords(lat?: number, lng?: number): { topPercent: number; leftPercent: number } {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { topPercent: 50, leftPercent: 50 };
  }
  // Kinshasa bounding box: lat -4.27 (north) to -4.43 (south), lng 15.22 (west) to 15.42 (east)
  const top = ((lat - -4.27) / (-4.43 - -4.27)) * 76 + 12;
  const left = ((lng - 15.22) / (15.42 - 15.22)) * 76 + 12;
  return {
    topPercent: Math.max(10, Math.min(88, top)),
    leftPercent: Math.max(10, Math.min(88, left)),
  };
}

function classifyIncident(category: string): 'braquage' | 'accident' | 'incident' {
  const c = category.toLowerCase();
  if (c.includes('braquage') || c.includes('vol') || c.includes('sos')) return 'braquage';
  if (c.includes('accident')) return 'accident';
  return 'incident';
}

const MAP_FILTERS: { id: MapPinFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'braquage', label: 'Braquage / SOS' },
  { id: 'accident', label: 'Accident' },
  { id: 'incident', label: 'Incident' },
  { id: 'poste', label: 'Commissariats' },
];

export const IncidentMapScreen: React.FC<IncidentMapScreenProps> = ({
  incidents,
  stations,
  onBack,
  initialFocusDistrict,
}) => {
  const [filter, setFilter] = useState<MapPinFilter>('all');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const allPins = useMemo<ComputedPin[]>(() => {
    const incPins: ComputedPin[] = incidents.map((inc) => {
      const pos = projectKinshasaCoords(inc.latitude, inc.longitude);
      return {
        id: inc.id,
        kind: classifyIncident(inc.category),
        label: inc.category,
        subtitle: `${inc.timestamp} · ${inc.status}`,
        district: inc.location,
        description: `Dossier ${inc.reference} confirmé par le Centre de Commandement PNC.`,
        topPercent: pos.topPercent,
        leftPercent: pos.leftPercent,
      };
    });

    const stPins: ComputedPin[] = stations.map((st) => {
      const pos = projectKinshasaCoords(st.latitude, st.longitude);
      return {
        id: st.id,
        kind: 'poste',
        label: st.name,
        subtitle: st.hours,
        district: st.commune,
        description: `${st.address} · Tél : ${st.phone}`,
        topPercent: pos.topPercent,
        leftPercent: pos.leftPercent,
      };
    });

    return [...incPins, ...stPins];
  }, [incidents, stations]);

  const [selectedPinId, setSelectedPinId] = useState<string | null>(() => {
    if (initialFocusDistrict) {
      const found = allPins.find((p) =>
        p.district.toLowerCase().includes(initialFocusDistrict.toLowerCase())
      );
      if (found) return found.id;
    }
    return allPins[0]?.id || null;
  });

  const visiblePins = allPins.filter((pin) => {
    if (filter === 'all') return true;
    return pin.kind === filter;
  });

  const selectedPin = allPins.find((p) => p.id === selectedPinId) || null;

  const handleLocateMe = () => {
    if (!('geolocation' in navigator)) {
      setGeoError('La géolocalisation n’est pas prise en charge par votre navigateur.');
      return;
    }
    setGeoError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setGeoError('Impossible d’obtenir votre position GPS. Vérifiez les autorisations.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const userPinPos = userCoords ? projectKinshasaCoords(userCoords.lat, userCoords.lng) : null;

  const getPinStyle = (kind: ComputedPin['kind']) => {
    switch (kind) {
      case 'braquage':
        return { bg: 'bg-sos-red text-on-sos-red', icon: 'warning' };
      case 'accident':
        return { bg: 'bg-light-primary-container text-light-on-primary-container', icon: 'directions_car' };
      case 'incident':
        return { bg: 'bg-warning text-on-warning', icon: 'priority_high' };
      case 'poste':
        return { bg: 'bg-light-primary text-light-on-primary', icon: 'local_police' };
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen lg:min-h-[calc(100vh-2rem)]">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-3 border-b border-light-outline-variant dark:border-dark-outline-variant z-20">
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            aria-label="Retour"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
          >
            <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
          </button>
          <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
            Carte de sécurité
          </h1>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrer la carte">
          {MAP_FILTERS.map((tab) => {
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
                    : 'bg-light-surface-container dark:bg-dark-surface-container text-light-on-surface-variant dark:text-dark-on-surface-variant'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="relative flex-1 min-h-[620px] lg:rounded-b-xl overflow-hidden bg-light-surface-container border-x border-b border-light-outline-variant/40">
        {/* Kinshasa Cartographic Grid */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 390 700"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <rect width="390" height="700" fill="#EAECEF" />
          <path d="M 0 110 Q 120 70 240 95 T 390 60 L 390 0 L 0 0 Z" fill="#C7DDF5" />
          <rect x="30" y="150" width="90" height="70" rx="8" fill="#D5E8D4" />
          <rect x="250" y="210" width="110" height="80" rx="8" fill="#D5E8D4" />
          <rect x="60" y="420" width="100" height="90" rx="8" fill="#D5E8D4" />
          <path d="M 0 260 L 390 230" stroke="#FFFFFF" strokeWidth="10" />
          <path d="M 0 260 L 390 230" stroke="#F6C978" strokeWidth="4" />
          <path d="M 180 90 L 160 700" stroke="#FFFFFF" strokeWidth="9" />
          <path d="M 40 120 L 320 680" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M 0 480 L 390 450" stroke="#FFFFFF" strokeWidth="7" />
          <path d="M 290 120 L 270 700" stroke="#FFFFFF" strokeWidth="6" />
          <text x="155" y="195" fill="#64748B" fontSize="13" fontFamily="Instrument Sans, sans-serif" fontWeight="600">
            Gombe
          </text>
          <text x="55" y="340" fill="#64748B" fontSize="15" fontFamily="Instrument Sans, sans-serif" fontWeight="700">
            Kinshasa
          </text>
          <text x="240" y="175" fill="#64748B" fontSize="12" fontFamily="Instrument Sans, sans-serif" fontWeight="600">
            Limete
          </text>
          <text x="235" y="545" fill="#64748B" fontSize="12" fontFamily="Instrument Sans, sans-serif" fontWeight="600">
            Kintambo
          </text>
        </svg>

        {visiblePins.length === 0 && (
          <div className="absolute top-4 inset-x-4 max-w-md mx-auto bg-light-surface-container-lowest/95 dark:bg-dark-surface-container-low/95 border border-light-outline-variant dark:border-dark-outline-variant rounded-md px-4 py-3 shadow-md z-20 text-center">
            <p className="text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Aucun incident confirmé ni commissariat enregistré dans ce filtre.
            </p>
          </div>
        )}

        {geoError && (
          <div className="absolute top-16 inset-x-4 max-w-md mx-auto bg-sos-container text-on-sos-container rounded-md px-3 py-2 shadow z-30 text-xs font-medium text-center">
            {geoError}
          </div>
        )}

        {/* Real Map Pins */}
        {visiblePins.map((pin) => {
          const style = getPinStyle(pin.kind);
          const isSelected = selectedPin?.id === pin.id;
          return (
            <button
              key={pin.id}
              type="button"
              aria-label={`${pin.label} à ${pin.district}`}
              onClick={() => setSelectedPinId(pin.id)}
              style={{ top: `${pin.topPercent}%`, left: `${pin.leftPercent}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full ${style.bg} border-2 border-light-surface-container-lowest shadow-md flex items-center justify-center transition-transform ${
                isSelected ? 'scale-125 ring-4 ring-light-primary/30 z-20' : 'hover:scale-110 z-10'
              }`}
            >
              <MaterialIcon name={style.icon} filled className="text-[16px]" />
            </button>
          );
        })}

        {/* Real Browser GPS Location Marker */}
        {userPinPos && userCoords && (
          <div
            style={{ top: `${userPinPos.topPercent}%`, left: `${userPinPos.leftPercent}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none"
          >
            <span className="w-5 h-5 rounded-full bg-light-primary-container border-3 border-white shadow-md" />
            <span className="mt-1 px-2 py-0.5 rounded bg-brand-navy text-white text-[10px] font-semibold whitespace-nowrap shadow tabular-nums">
              Ma position ({userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)})
            </span>
          </div>
        )}

        {/* Dynamic Floating Pin Details */}
        {selectedPin && (
          <div className="absolute top-4 right-4 left-4 sm:left-auto sm:w-72 bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md px-3.5 py-3 shadow-lg flex flex-col gap-1 z-30">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface block">
                  {selectedPin.label}
                </span>
                <span className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                  {selectedPin.subtitle} · {selectedPin.district}
                </span>
              </div>
              <button
                type="button"
                aria-label="Fermer la fiche"
                onClick={() => setSelectedPinId(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-light-on-surface-variant hover:bg-light-surface-container-low"
              >
                <MaterialIcon name="close" className="text-[16px]" />
              </button>
            </div>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant leading-relaxed">
              {selectedPin.description}
            </p>
          </div>
        )}

        {/* Bottom-Left Legend Card */}
        <aside
          aria-label="Légende de la carte"
          className="absolute bottom-5 left-4 bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-3 shadow-md flex flex-col gap-2 min-w-[156px] z-20"
        >
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sos-red shrink-0" />
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Braquage / SOS
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-light-primary-container shrink-0" />
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Accident
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-warning shrink-0" />
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Incident
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MaterialIcon name="location_on" filled className="text-[16px] text-light-primary shrink-0" />
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Poste de police
            </span>
          </div>
        </aside>

        {/* Map Locate Button */}
        <button
          type="button"
          aria-label="Centrer sur ma position GPS"
          onClick={handleLocateMe}
          disabled={locating}
          className={`absolute bottom-5 right-4 w-11 h-11 rounded-full border shadow-md flex items-center justify-center z-20 transition-colors ${
            userCoords
              ? 'bg-light-primary-container text-white border-light-primary'
              : 'bg-light-surface-container-lowest dark:bg-dark-surface-container-low text-light-primary border-light-outline-variant'
          }`}
        >
          <MaterialIcon name="my_location" className="text-[22px]" />
        </button>
      </main>
    </div>
  );
};
