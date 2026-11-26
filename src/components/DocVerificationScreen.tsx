import React, { useRef, useState } from 'react';
import { pncApi } from '../services/api';
import { VerifiableDocument } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface DocVerificationScreenProps {
  onBack: () => void;
}

export const DocVerificationScreen: React.FC<DocVerificationScreenProps> = ({ onBack }) => {
  const [docNumber, setDocNumber] = useState('');
  const [checking, setChecking] = useState(false);
  const [scanNotice, setScanNotice] = useState('');
  const [result, setResult] = useState<
    { found: true; doc: VerifiableDocument } | { found: false; query: string } | null
  >(null);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  const lookupDocument = async (rawQuery: string) => {
    const q = rawQuery.trim().toUpperCase();
    if (!q) return;
    setChecking(true);
    setScanNotice('');
    try {
      const res = await pncApi.verifyDocument(q);
      if (res.found && res.document) {
        setResult({ found: true, doc: res.document });
      } else {
        setResult({ found: false, query: q });
      }
    } catch (err) {
      setScanNotice(err instanceof Error ? err.message : 'Erreur lors de la vérification.');
    } finally {
      setChecking(false);
    }
  };

  const handleImageQrScan = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setScanNotice('');
    try {
      const DetectorCtor = (window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect: (img: ImageBitmap) => Promise<{ rawValue?: string }[]>;
        };
      }).BarcodeDetector;
      if (!DetectorCtor) {
        setScanNotice(
          'La détection QR automatique n’est pas prise en charge par ce navigateur. Veuillez saisir le numéro manuellement.'
        );
        return;
      }
      const bitmap = await createImageBitmap(file);
      const detector = new DetectorCtor({ formats: ['qr_code', 'code_128'] });
      const codes = await detector.detect(bitmap);
      if (codes.length > 0 && codes[0].rawValue) {
        const val = codes[0].rawValue.trim().toUpperCase();
        setDocNumber(val);
        await lookupDocument(val);
      } else {
        setScanNotice('Aucun QR code ou code-barres lisible détecté sur cette image.');
      }
    } catch {
      setScanNotice('Impossible d’analyser l’image sélectionnée. Saisissez le numéro manuellement.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void lookupDocument(docNumber);
  };

  return (
    <div className="flex flex-col flex-1 bg-light-surface-container-lowest dark:bg-dark-surface-container-low lg:rounded-xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant lg:my-6 lg:mx-6 px-4 lg:px-8 py-5">
      <header className="flex items-center gap-3 mb-6">
        <button
          type="button"
          aria-label="Retour"
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
        >
          <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
        </button>
        <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
          Vérification documentaire
        </h1>
      </header>

      <main className="flex flex-col items-center gap-6 max-w-md mx-auto w-full">
        <p className="font-body text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant text-center px-2">
          Importez ou capturez le QR code d&apos;un document PNC officiel, ou saisissez son numéro de référence.
        </p>

        <div className="w-44 h-44 rounded-lg bg-light-surface-container-low dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant flex flex-col items-center justify-center p-4">
          <MaterialIcon
            name="qr_code_2"
            className={`text-[128px] text-light-primary dark:text-dark-primary transition-opacity ${
              checking ? 'opacity-40' : 'opacity-100'
            }`}
          />
        </div>

        <input
          ref={qrFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleImageQrScan(e.target.files)}
        />

        <button
          type="button"
          onClick={() => qrFileInputRef.current?.click()}
          disabled={checking}
          className="w-full min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <MaterialIcon name="qr_code_scanner" className="text-[20px]" />
          <span>{checking ? 'Vérification...' : 'Scanner ou importer un QR code'}</span>
        </button>

        {scanNotice && (
          <p className="text-xs font-medium text-warning text-center">{scanNotice}</p>
        )}

        <form onSubmit={handleSubmit} className="w-full pt-4 border-t border-light-outline-variant dark:border-dark-outline-variant flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
              Ou entrez le numéro de référence
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="Ex. PL-2026-000001"
                className="flex-1 min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant text-sm font-mono text-light-on-surface dark:text-dark-on-surface placeholder:font-body placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
              />
              <button
                type="submit"
                disabled={checking}
                className="min-h-12 px-4 rounded-md bg-light-secondary-container text-light-on-secondary-container font-headline text-sm font-semibold hover:opacity-90 shrink-0 disabled:opacity-60"
              >
                Vérifier
              </button>
            </div>
          </label>
        </form>

        {result && (
          <section className="w-full">
            {result.found ? (
              <div className="p-4 rounded-md bg-success-container text-on-success-container flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-headline font-bold text-sm">
                    <MaterialIcon name="verified" filled className="text-[20px]" />
                    <span>Document authentique ({result.doc.status})</span>
                  </div>
                  <span className="font-mono text-xs font-semibold tabular-nums">
                    {result.doc.number}
                  </span>
                </div>
                <p className="text-xs font-medium">{result.doc.type}</p>
                <div className="text-xs opacity-90 flex flex-col gap-0.5">
                  <span>Titulaire : {result.doc.holderName}</span>
                  <span>Émis par : {result.doc.issuedBy}</span>
                  <span>Date d&apos;émission : {result.doc.issuedDate}</span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-md bg-sos-container text-on-sos-container flex items-start gap-2.5">
                <MaterialIcon name="error" filled className="text-[20px] shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold">Aucun document enregistré pour « {result.query} »</p>
                  <p className="mt-0.5">
                    Vérifiez le numéro saisi ou consultez le commissariat émetteur.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
