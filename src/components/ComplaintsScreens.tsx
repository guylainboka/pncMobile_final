import React, { useRef, useState } from 'react';
import { Complaint } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface FileComplaintScreenProps {
  onBack: () => void;
  onSubmitComplaint: (complaint: Omit<Complaint, 'id' | 'reference' | 'date' | 'status' | 'assignedStation'>) => void;
}

export const FileComplaintScreen: React.FC<FileComplaintScreenProps> = ({
  onBack,
  onSubmitComplaint,
}) => {
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const names = Array.from(files).map((f) => f.name);
    setAttachments((prev) => [...prev, ...names]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type || !location.trim() || !description.trim()) {
      setError('Veuillez sélectionner le type de plainte, le lieu et la description.');
      return;
    }
    setError('');
    onSubmitComplaint({
      type,
      location: location.trim(),
      description: description.trim(),
      attachments,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col flex-1 justify-between min-h-screen lg:min-h-0 bg-light-surface-container-lowest dark:bg-dark-surface-container-low lg:rounded-xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant lg:my-6 lg:mx-6 px-4 lg:px-8 py-5"
    >
      <div className="flex flex-col gap-5">
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Retour"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
          >
            <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
          </button>
          <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
            Déposer plainte en ligne
          </h1>
        </header>

        <main className="flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-md bg-sos-container text-on-sos-container text-xs font-medium flex items-center gap-2">
              <MaterialIcon name="error" className="text-[18px] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Type de plainte
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
            >
              <option value="">Sélectionnez le type de plainte</option>
              <option value="Vol de téléphone">Vol de téléphone / biens</option>
              <option value="Escroquerie">Escroquerie</option>
              <option value="Perte de document">Perte de document</option>
              <option value="Violence">Violence / Agression</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Lieu de l&apos;incident
            </span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Entrez le lieu exact"
              className="w-full min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Description détaillée
            </span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez en détail les faits"
              className="w-full p-3.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary resize-none"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Pièces jointes
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[84px] px-4 py-4 rounded-md border border-dashed border-light-outline dark:border-dark-outline bg-light-surface-container-low dark:bg-dark-surface-container hover:bg-light-surface-container transition-colors flex flex-col items-center justify-center gap-1.5 text-center"
            >
              <MaterialIcon name="upload_file" className="text-[24px] text-light-primary-container dark:text-dark-primary" />
              <span className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Ajoutez des documents ou photos
              </span>
            </button>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((file, idx) => (
                  <span
                    key={`${file}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-light-surface-container text-xs font-medium"
                  >
                    <MaterialIcon name="description" className="text-[14px] text-light-primary" />
                    <span className="truncate max-w-[160px]">{file}</span>
                    <button
                      type="button"
                      aria-label={`Retirer ${file}`}
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-light-on-surface-variant hover:text-sos-red"
                    >
                      <MaterialIcon name="close" className="text-[14px]" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <footer className="pt-6 pb-2">
        <button
          type="submit"
          className="w-full lg:max-w-xs min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center"
        >
          Soumettre la plainte
        </button>
      </footer>
    </form>
  );
};

interface ComplaintsHistoryScreenProps {
  complaints: Complaint[];
  onBack: () => void;
  onNewComplaint: () => void;
}

export const ComplaintsHistoryScreen: React.FC<ComplaintsHistoryScreenProps> = ({
  complaints,
  onBack,
  onNewComplaint,
}) => {
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const getBadgeStyle = (status: Complaint['status']) => {
    if (status === 'Reçue' || status === 'Clôturée') {
      return 'bg-success-container text-on-success-container';
    }
    return 'bg-info-container text-on-info-container';
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="bg-light-surface-container-lowest dark:bg-dark-surface-container-low px-4 lg:px-6 pt-5 pb-4 border-b border-light-outline-variant dark:border-dark-outline-variant flex items-center justify-between gap-3 sticky top-0 z-20">
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
            Mes plaintes
          </h1>
        </div>
        <button
          type="button"
          onClick={onNewComplaint}
          className="min-h-[38px] px-3.5 py-1.5 rounded-md bg-light-primary-container text-light-on-primary-container font-label text-xs font-semibold hover:bg-light-primary transition-colors flex items-center gap-1.5"
        >
          <MaterialIcon name="add" className="text-[16px]" />
          <span>Déposer</span>
        </button>
      </header>

      <main className="px-4 lg:px-6 py-4 flex flex-col gap-3">
        {complaints.length === 0 ? (
          <div className="p-8 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-center flex flex-col items-center gap-2">
            <MaterialIcon name="folder_open" className="text-[32px] text-light-on-surface-variant" />
            <p className="text-sm font-medium text-light-on-surface dark:text-dark-on-surface">
              Aucune plainte déposée pour le moment
            </p>
            <p className="text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Utilisez le bouton « Déposer » pour enregistrer une plainte officielle.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {complaints.map((c) => (
              <article
                key={c.id}
                onClick={() => setSelectedComplaint(c)}
                className="cursor-pointer bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant rounded-md p-4 flex flex-col gap-2 hover:border-light-primary transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-mono text-[13px] font-semibold text-light-on-surface dark:text-dark-on-surface tabular-nums">
                    {c.reference}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-label text-[11px] font-semibold shrink-0 ${getBadgeStyle(
                      c.status
                    )}`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-body text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                    {c.type}
                  </span>
                  <span className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant tabular-nums">
                    {c.date}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {selectedComplaint && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelectedComplaint(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl sm:rounded-2xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-4 shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-semibold text-light-primary-container dark:text-dark-primary tabular-nums">
                  {selectedComplaint.reference}
                </p>
                <h2 className="font-headline text-lg font-bold mt-0.5">{selectedComplaint.type}</h2>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setSelectedComplaint(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-light-surface-container-low"
              >
                <MaterialIcon name="close" />
              </button>
            </div>

            <div className="text-sm text-light-on-surface dark:text-dark-on-surface leading-relaxed">
              {selectedComplaint.description}
            </div>

            <div className="p-3 rounded-md bg-light-surface-container-low dark:bg-dark-surface-container flex flex-col gap-1.5 text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
              <span>Lieu : {selectedComplaint.location}</span>
              <span>Unité assignée : {selectedComplaint.assignedStation}</span>
              <span>Date de dépôt : {selectedComplaint.date}</span>
              <span>Statut : {selectedComplaint.status}</span>
            </div>

            <button
              type="button"
              onClick={() => setSelectedComplaint(null)}
              className="w-full min-h-[44px] rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
