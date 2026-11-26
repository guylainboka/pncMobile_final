import React, { useRef, useState } from 'react';
import { pncApi } from '../services/api';
import { MediaAttachment, ReportDraft } from '../types';
import { MaterialIcon } from './MaterialIcon';

const CATEGORIES = [
  { id: 'Braquage', label: 'Braquage', icon: 'local_police' },
  { id: 'Accident', label: 'Accident', icon: 'car_crash' },
  { id: 'Corruption', label: 'Corruption', icon: 'gavel' },
  { id: 'Violence', label: 'Violence', icon: 'front_hand' },
  { id: 'Activité suspecte', label: 'Activité suspecte', icon: 'visibility' },
  { id: 'Autre', label: 'Autre', icon: 'more_horiz' },
];

interface ReportStep1Props {
  draft: ReportDraft;
  onUpdate: (patch: Partial<ReportDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}

export const ReportStep1Screen: React.FC<ReportStep1Props> = ({
  draft,
  onUpdate,
  onBack,
  onNext,
}) => {
  const [error, setError] = useState('');
  const [geoNotice, setGeoNotice] = useState('');
  const [locating, setLocating] = useState(false);

  const handleLocate = () => {
    if (!('geolocation' in navigator)) {
      setGeoNotice('La géolocalisation n’est pas disponible sur cet appareil. Saisissez l’adresse.');
      return;
    }
    setGeoNotice('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const geo = await pncApi.geocode(latitude, longitude);
          onUpdate({ location: geo.address, latitude, longitude });
        } catch {
          onUpdate({
            location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            latitude,
            longitude,
          });
        } finally {
          setLocating(false);
        }
      },
      () => {
        setGeoNotice('Autorisation GPS refusée ou signal indisponible. Saisissez le lieu manuellement.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleContinue = () => {
    if (!draft.location.trim()) {
      setError("Veuillez indiquer le lieu de l'incident.");
      return;
    }
    if (!draft.description.trim()) {
      setError("Veuillez décrire brièvement l'incident avant de continuer.");
      return;
    }
    setError('');
    onNext();
  };

  return (
    <div className="flex flex-col flex-1 justify-between min-h-screen lg:min-h-0 bg-light-surface-container-lowest dark:bg-dark-surface-container-low lg:rounded-xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant lg:my-6 lg:mx-6 px-4 lg:px-8 py-5">
      <div className="flex flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
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
              Signaler un incident
            </h1>
          </div>
          <span className="font-mono text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
            1 / 3
          </span>
        </header>

        <main className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-headline text-base font-semibold text-light-on-surface dark:text-dark-on-surface">
                Que s&apos;est-il passé ?
              </h2>
              <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Sélectionnez le type d&apos;incident
              </p>
            </div>

            <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5">
              {CATEGORIES.map((cat) => {
                const selected = draft.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => onUpdate({ category: cat.id })}
                    className={`rounded-md p-3 flex flex-col items-center text-center gap-2 transition-colors min-h-[84px] justify-center ${
                      selected
                        ? 'bg-light-secondary-container dark:bg-dark-secondary-container border-2 border-light-primary-container dark:border-dark-primary'
                        : 'bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant hover:border-light-primary'
                    }`}
                  >
                    <MaterialIcon
                      name={cat.icon}
                      className={`text-[24px] ${
                        selected
                          ? 'text-light-primary dark:text-dark-primary'
                          : 'text-light-on-surface-variant dark:text-dark-on-surface-variant'
                      }`}
                    />
                    <span
                      className={`font-label text-xs font-semibold leading-tight ${
                        selected
                          ? 'text-light-on-secondary-container dark:text-dark-on-secondary-container'
                          : 'text-light-on-surface dark:text-dark-on-surface'
                      }`}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-1.5">
            <span className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
              Localisation
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft.location}
                onChange={(e) => {
                  setError('');
                  onUpdate({ location: e.target.value });
                }}
                placeholder="Adresse, avenue ou commune"
                className="flex-1 min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
              <button
                type="button"
                onClick={handleLocate}
                disabled={locating}
                aria-label="Utiliser ma position GPS"
                className="min-h-12 px-3.5 rounded-md border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container text-light-primary dark:text-dark-primary text-xs font-semibold flex items-center gap-1.5 hover:bg-light-surface-container shrink-0"
              >
                <MaterialIcon name="my_location" className="text-[18px]" />
                <span className="hidden sm:inline">{locating ? 'GPS...' : 'Position'}</span>
              </button>
            </div>
            {geoNotice && <p className="text-xs text-warning">{geoNotice}</p>}
          </section>

          <section className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                Décrivez ce qui s&apos;est passé
              </span>
              <textarea
                rows={5}
                maxLength={800}
                value={draft.description}
                onChange={(e) => {
                  setError('');
                  onUpdate({ description: e.target.value });
                }}
                placeholder="Donnez un maximum de détails factuels..."
                className="w-full p-3.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary resize-none"
              />
            </label>
            <div className="flex items-center justify-between">
              {error ? (
                <span className="text-xs font-medium text-sos-red">{error}</span>
              ) : (
                <span />
              )}
              <span className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                {draft.description.length}/800
              </span>
            </div>
          </section>
        </main>
      </div>

      <footer className="pt-4 pb-2">
        <button
          type="button"
          onClick={handleContinue}
          className="w-full lg:max-w-xs min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center"
        >
          Suivant
        </button>
      </footer>
    </div>
  );
};

interface ReportStep2Props {
  draft: ReportDraft;
  onUpdate: (patch: Partial<ReportDraft>) => void;
  onBack: () => void;
  onNext: () => void;
}

function readFileAsDataUrl(file: File): Promise<string | undefined> {
  if (file.size > 900_000) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

export const ReportStep2Screen: React.FC<ReportStep2Props> = ({
  draft,
  onUpdate,
  onBack,
  onNext,
}) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordStartRef = useRef<number>(0);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const addFileAttachment = async (type: 'photo' | 'video', fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setMediaError('');
    const file = fileList[0];
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const dataUrl = type === 'photo' ? await readFileAsDataUrl(file) : undefined;
    const next: MediaAttachment = {
      id: `att-${Date.now()}`,
      type,
      name: file.name,
      sizeOrDuration: `${sizeMb} Mo`,
      dataUrl,
    };
    onUpdate({ attachments: [...draft.attachments, next] });
  };

  const toggleAudioRecord = async () => {
    setMediaError('');
    if (recordingAudio && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingAudio(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaError('L’enregistrement audio direct n’est pas pris en charge par ce navigateur.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recordStartRef.current = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationSec = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const mins = Math.floor(durationSec / 60);
        const secs = String(durationSec % 60).padStart(2, '0');
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: blob.type });
        const dataUrl = await readFileAsDataUrl(file);
        const next: MediaAttachment = {
          id: `att-${Date.now()}`,
          type: 'audio',
          name: `Note vocale (${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })})`,
          sizeOrDuration: `${mins}:${secs}`,
          dataUrl,
        };
        onUpdate({ attachments: [...draft.attachments, next] });
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordingAudio(true);
    } catch {
      setMediaError('Accès au microphone refusé ou indisponible.');
    }
  };

  const removeAttachment = (id: string) => {
    onUpdate({ attachments: draft.attachments.filter((a) => a.id !== id) });
  };

  return (
    <div className="flex flex-col flex-1 justify-between min-h-screen lg:min-h-0 bg-light-surface-container-lowest dark:bg-dark-surface-container-low lg:rounded-xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant lg:my-6 lg:mx-6 px-4 lg:px-8 py-5">
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between gap-3">
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
              Ajouter des preuves
            </h1>
          </div>
          <span className="font-mono text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
            2 / 3
          </span>
        </header>

        <main className="flex flex-col gap-4">
          <p className="font-body text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
            Joignez des éléments réels (facultatif)
          </p>

          {mediaError && (
            <div className="p-3 rounded-md bg-sos-container text-on-sos-container text-xs font-medium">
              {mediaError}
            </div>
          )}

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void addFileAttachment('photo', e.target.files);
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void addFileAttachment('video', e.target.files);
            }}
          />

          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="w-full bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex items-center gap-3.5 hover:border-light-primary transition-colors text-left"
          >
            <span className="w-11 h-11 rounded-md bg-light-secondary-container text-light-primary flex items-center justify-center shrink-0">
              <MaterialIcon name="photo_camera" className="text-[22px]" />
            </span>
            <div className="flex-1">
              <h2 className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                Photo
              </h2>
              <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Galerie ou Caméra
              </p>
            </div>
            <MaterialIcon name="chevron_right" className="text-light-on-surface-variant text-[20px]" />
          </button>

          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="w-full bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex items-center gap-3.5 hover:border-light-primary transition-colors text-left"
          >
            <span className="w-11 h-11 rounded-md bg-sos-container text-sos-red flex items-center justify-center shrink-0">
              <MaterialIcon name="videocam" className="text-[22px]" />
            </span>
            <div className="flex-1">
              <h2 className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                Vidéo
              </h2>
              <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Importer ou filmer une vidéo
              </p>
            </div>
            <MaterialIcon name="chevron_right" className="text-light-on-surface-variant text-[20px]" />
          </button>

          <button
            type="button"
            onClick={() => {
              void toggleAudioRecord();
            }}
            className={`w-full rounded-md p-4 flex items-center gap-3.5 border transition-colors text-left ${
              recordingAudio
                ? 'bg-sos-container/40 border-sos-red'
                : 'bg-light-surface-container-lowest dark:bg-dark-surface-container border-light-outline-variant dark:border-dark-outline-variant hover:border-light-primary'
            }`}
          >
            <span className="w-11 h-11 rounded-md bg-info-container text-info flex items-center justify-center shrink-0">
              <MaterialIcon name={recordingAudio ? 'stop' : 'mic'} className="text-[22px]" />
            </span>
            <div className="flex-1">
              <h2 className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                {recordingAudio ? 'Arrêter l’enregistrement audio' : 'Audio (microphone)'}
              </h2>
              <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                {recordingAudio ? 'Enregistrement actif — appuyez pour terminer' : 'Enregistrer un message vocal réel'}
              </p>
            </div>
            <MaterialIcon name="chevron_right" className="text-light-on-surface-variant text-[20px]" />
          </button>

          {draft.attachments.length > 0 && (
            <section className="flex flex-col gap-2 pt-2">
              <h3 className="font-headline text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Éléments joints ({draft.attachments.length})
              </h3>
              {draft.attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-3 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MaterialIcon
                      name={
                        att.type === 'photo'
                          ? 'image'
                          : att.type === 'video'
                          ? 'movie'
                          : 'graphic_eq'
                      }
                      className="text-light-primary shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-light-on-surface dark:text-dark-on-surface truncate">
                        {att.name}
                      </p>
                      <p className="text-[11px] text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                        {att.sizeOrDuration}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Supprimer ${att.name}`}
                    onClick={() => removeAttachment(att.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-light-on-surface-variant hover:text-sos-red"
                  >
                    <MaterialIcon name="delete" className="text-[18px]" />
                  </button>
                </div>
              ))}
            </section>
          )}
        </main>
      </div>

      <footer className="pt-4 pb-2">
        <button
          type="button"
          onClick={onNext}
          className="w-full lg:max-w-xs min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center"
        >
          Suivant
        </button>
      </footer>
    </div>
  );
};

interface ReportStep3Props {
  draft: ReportDraft;
  onUpdate: (patch: Partial<ReportDraft>) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
}

export const ReportStep3Screen: React.FC<ReportStep3Props> = ({
  draft,
  onUpdate,
  onBack,
  onSubmit,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async () => {
    setSubmitError('');
    setSubmitting(true);
    try {
      await onSubmit();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Échec d'envoi du signalement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 justify-between min-h-screen lg:min-h-0 bg-light-surface-container-lowest dark:bg-dark-surface-container-low lg:rounded-xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant lg:my-6 lg:mx-6 px-4 lg:px-8 py-5">
      <div className="flex flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
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
              Options de confidentialité
            </h1>
          </div>
          <span className="font-mono text-xs font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
            3 / 3
          </span>
        </header>

        <main className="flex flex-col gap-5">
          {submitError && (
            <div className="p-3 rounded-md bg-sos-container text-on-sos-container text-xs font-medium">
              {submitError}
            </div>
          )}

          <label className="bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.anonymous}
              onChange={(e) => onUpdate({ anonymous: e.target.checked })}
              className="mt-0.5 w-5 h-5 rounded-sm border-light-outline text-light-primary-container focus:ring-light-primary"
            />
            <div className="flex flex-col gap-1">
              <span className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                Envoyer anonymement
              </span>
              <span className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Cochez cette case pour envoyer votre signalement sans partager votre identité ni votre numéro.
              </span>
            </div>
          </label>

          {!draft.anonymous && (
            <section className="flex flex-col gap-3.5">
              <h2 className="font-headline text-sm font-semibold text-light-on-surface dark:text-dark-on-surface">
                Informations de contact (facultatif)
              </h2>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Nom complet
                </span>
                <input
                  type="text"
                  value={draft.contactName}
                  onChange={(e) => onUpdate({ contactName: e.target.value })}
                  placeholder="Votre nom complet"
                  className="w-full min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Téléphone
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={draft.contactPhone}
                  onChange={(e) => onUpdate({ contactPhone: e.target.value })}
                  placeholder="+243 81 000 0000"
                  className="w-full min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary tabular-nums"
                />
              </label>
            </section>
          )}

          <aside className="bg-success-container text-on-success-container rounded-md p-3.5 flex items-start gap-2.5">
            <MaterialIcon name="verified_user" filled className="text-[20px] shrink-0 mt-0.5" />
            <p className="font-body text-xs leading-relaxed">
              Votre signalement sera transmis directement au Centre de Commandement PNC pour vérification avant toute affectation.
            </p>
          </aside>
        </main>
      </div>

      <footer className="pt-4 pb-2">
        <button
          type="button"
          onClick={() => {
            void handleSubmit();
          }}
          disabled={submitting}
          className="w-full lg:max-w-xs min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center disabled:opacity-60"
        >
          {submitting ? 'Envoi en cours...' : "Envoyer l'alerte"}
        </button>
      </footer>
    </div>
  );
};
