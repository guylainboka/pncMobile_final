import React, { useEffect, useState } from 'react';
import { ASSETS } from '../data/mockData';
import { MaterialIcon } from './MaterialIcon';

interface SplashScreenProps {
  onContinue: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onContinue }) => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onContinue();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [onContinue]);

  return (
    <main
      onClick={onContinue}
      className="min-h-screen w-full bg-brand-navy text-on-brand-navy flex flex-col items-center justify-between px-6 py-16 cursor-pointer select-none"
    >
      <div className="h-8" />

      <section className="flex flex-col items-center text-center gap-6">
        <div className="w-40 h-40 md:w-44 md:h-44 rounded-full overflow-hidden flex items-center justify-center bg-brand-navy border-2 border-light-inverse-primary/30 shadow-xl p-3">
          <img
            src={ASSETS.pncCrest}
            alt="Emblème de la Police Nationale Congolaise"
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-display text-[28px] md:text-[36px] font-bold text-on-brand-navy tracking-tight">
            PNC Alerte
          </h1>
          <p className="font-body text-base md:text-lg text-light-inverse-primary">
            Votre sécurité, notre priorité
          </p>
        </div>
      </section>

      <div className="flex flex-col items-center gap-4 pb-4">
        <div
          className="w-8 h-8 rounded-full border-2 border-light-inverse-primary border-t-transparent animate-spin"
          role="status"
          aria-label="Chargement en cours"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContinue();
          }}
          className="text-xs font-medium text-light-inverse-primary/80 hover:text-white transition-colors px-3 py-1.5"
        >
          Appuyer pour continuer
        </button>
      </div>
    </main>
  );
};

interface OnboardingScreenProps {
  onFinish: () => void;
}

const SLIDES = [
  {
    image: ASSETS.onboardingPolice,
    alt: 'Agent de la Police Nationale Congolaise avec véhicule de patrouille',
    title: 'Ensemble pour une communauté plus sûre',
    description: 'Signalez, informez, protégez. La police est à vos côtés.',
  },
  {
    image: ASSETS.onboardingAlert,
    alt: 'Citoyen consultant la carte des alertes de sécurité sur smartphone',
    title: 'Alertes officielles et carte en direct',
    description:
      'Recevez les avis urgents de la PNC et localisez les incidents ou commissariats proches de vous.',
  },
  {
    image: ASSETS.onboardingCommunity,
    alt: 'Agents de police de proximité échangeant avec les citoyens à Kinshasa',
    title: 'Suivi en temps réel et anonymat garanti',
    description:
      'Suivez l’arrivée de la patrouille en direct ou déposez un signalement anonyme en toute confiance.',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const current = SLIDES[step];

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      setStep((s) => s + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div className="min-h-screen w-full bg-light-surface dark:bg-dark-background flex items-center justify-center lg:p-8">
      <div className="min-h-screen lg:min-h-[640px] w-full max-w-[430px] lg:max-w-4xl mx-auto bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest lg:rounded-2xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant lg:shadow-sm flex flex-col justify-between px-4 lg:px-10 py-8">
        <header className="flex items-center justify-between pt-2">
          <span className="w-16 hidden sm:inline-block" />
          <span className="font-headline text-xl font-bold text-light-primary dark:text-dark-primary">
            PNC Alerte
          </span>
          <button
            type="button"
            onClick={onFinish}
            className="min-h-[40px] px-3 text-sm font-medium text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-primary dark:hover:text-dark-primary transition-colors"
          >
            Passer
          </button>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 items-center gap-6 lg:gap-10 my-auto py-4">
          <div className="w-full rounded-lg overflow-hidden bg-light-surface-container-low dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant aspect-[4/3]">
            <img
              src={current.image}
              alt={current.alt}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-5 px-2">
            <div className="flex flex-col gap-2">
              <h1 className="font-headline text-2xl lg:text-3xl font-bold text-light-on-surface dark:text-dark-on-surface text-balance">
                {current.title}
              </h1>
              <p className="font-body text-sm lg:text-base text-light-on-surface-variant dark:text-dark-on-surface-variant max-w-[340px] lg:max-w-md leading-relaxed">
                {current.description}
              </p>
            </div>

            {/* 3-Step Interactive Indicator */}
            <div className="flex items-center justify-center lg:justify-start gap-2" aria-label={`Étape ${step + 1} sur ${SLIDES.length}`}>
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Aller à l'étape ${idx + 1}`}
                  onClick={() => setStep(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === step
                      ? 'w-6 bg-light-primary-container'
                      : 'w-2 bg-light-outline-variant dark:bg-dark-outline-variant hover:bg-light-outline'
                  }`}
                />
              ))}
            </div>
          </div>
        </main>

        <footer className="pb-2 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="min-h-[48px] px-5 py-3 rounded-md border border-light-outline-variant dark:border-dark-outline-variant text-light-on-surface dark:text-dark-on-surface font-headline font-semibold text-[15px] hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low transition-colors flex items-center gap-1"
            >
              <MaterialIcon name="arrow_back" className="text-[18px]" />
              <span>Précédent</span>
            </button>
          ) : (
            <span className="hidden lg:inline-block" />
          )}

          <button
            type="button"
            onClick={handleNext}
            className="flex-1 lg:flex-none lg:min-w-[200px] min-h-[48px] px-6 py-3 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center gap-2"
          >
            <span>{step === SLIDES.length - 1 ? 'Commencer' : 'Suivant'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
