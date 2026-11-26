import React, { useState } from 'react';
import { ASSETS, KINSHASA_COMMUNES } from '../data/mockData';
import { getSupabaseClientSync } from '../lib/supabase';
import { pncApi } from '../services/api';
import { UserProfile } from '../types';
import { MaterialIcon } from './MaterialIcon';

interface LoginScreenProps {
  supabaseEnabled?: boolean;
  onAuthenticated: (token: string, user: UserProfile) => void;
  onGoToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  supabaseEnabled = false,
  onAuthenticated,
  onGoToRegister,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetNotice, setResetNotice] = useState('');

  const handleGoogleLogin = async () => {
    const sb = getSupabaseClientSync();
    if (!sb) return;
    setError('');
    setBusy(true);
    try {
      const { error: oauthErr } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (oauthErr) {
        setError(oauthErr.message);
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur OAuth Google.');
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawId = identifier.trim();
    if (!rawId || !password) {
      setError('Veuillez saisir votre téléphone (ou e-mail) et votre mot de passe.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      if (supabaseEnabled && rawId.includes('@')) {
        const sb = getSupabaseClientSync();
        if (sb) {
          const { data, error: sbErr } = await sb.auth.signInWithPassword({
            email: rawId,
            password,
          });
          if (sbErr || !data.session) {
            throw new Error(sbErr?.message || 'Identifiants incorrects.');
          }
          const me = await pncApi.citizenMe(data.session.access_token);
          onAuthenticated(data.session.access_token, me.user);
          return;
        }
      }

      const res = await pncApi.loginCitizen(
        rawId.includes('@') ? { email: rawId, password } : { phone: rawId, password }
      );
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-light-surface dark:bg-dark-background flex items-center justify-center lg:p-8">
      <div className="min-h-screen lg:min-h-[640px] w-full max-w-[430px] lg:max-w-4xl mx-auto bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest lg:rounded-2xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        {/* Desktop Civic Brand Panel */}
        <aside className="hidden lg:flex flex-col justify-between bg-brand-navy text-on-brand-navy p-10">
          <div className="flex items-center gap-3">
            <img
              src={ASSETS.pncCrest}
              alt="Emblème PNC"
              referrerPolicy="no-referrer"
              className="w-12 h-12 object-contain shrink-0"
            />
            <div>
              <p className="font-headline text-lg font-bold">PNC Alerte</p>
              <p className="text-xs text-light-inverse-primary">Police Nationale Congolaise</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-bold text-balance">
              Votre sécurité, notre priorité
            </h2>
            <p className="text-sm text-light-inverse-primary leading-relaxed">
              Connectez-vous pour transmettre vos signalements au Centre de Commandement PNC, suivre votre dossier en direct et recevoir les alertes officielles.
            </p>
          </div>
          <div className="pt-4 border-t border-white/15 flex items-center justify-between text-xs text-light-inverse-primary">
            <span>Urgence nationale : 112</span>
            <span>Liaison Centre de Commandement</span>
          </div>
        </aside>

        {/* Login Form Column */}
        <div className="flex flex-col justify-between px-4 sm:px-8 py-10">
          <main className="flex flex-col gap-5 pt-4 lg:pt-2">
            <header className="flex flex-col items-center text-center gap-1.5">
              <div className="lg:hidden w-16 h-16 rounded-full bg-brand-navy p-2 flex items-center justify-center mb-1">
                <img
                  src={ASSETS.pncCrest}
                  alt="Emblème PNC"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="font-headline text-2xl font-bold text-light-on-surface dark:text-dark-on-surface">
                Connexion citoyen
              </h1>
              <p className="font-body text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
                Accédez à votre espace personnel sécurisé
              </p>
            </header>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
              {error && (
                <div className="p-3 rounded-md bg-sos-container text-on-sos-container text-xs font-medium flex items-center gap-2">
                  <MaterialIcon name="error" className="text-[18px] shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  {supabaseEnabled ? 'Téléphone ou e-mail' : 'Numéro de téléphone'}
                </span>
                <div className="flex items-center rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant focus-within:border-light-primary focus-within:ring-1 focus-within:ring-light-primary overflow-hidden">
                  {!identifier.includes('@') && (
                    <span className="font-mono text-[13px] font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant px-3 py-3 border-r border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container tabular-nums">
                      +243
                    </span>
                  )}
                  <input
                    type={supabaseEnabled ? 'text' : 'tel'}
                    autoComplete={supabaseEnabled ? 'username' : 'tel'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={supabaseEnabled ? '81 000 0000 ou nom@exemple.cd' : '81 000 0000'}
                    className="w-full min-h-12 px-3 py-2.5 border-0 bg-transparent text-sm text-light-on-surface dark:text-dark-on-surface tabular-nums focus:outline-none focus:ring-0"
                  />
                </div>
              </label>

              <div className="flex flex-col gap-1.5">
                <label className="flex flex-col gap-1.5">
                  <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                    Mot de passe
                  </span>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Votre mot de passe"
                      className="w-full min-h-12 px-3.5 pr-11 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 w-9 h-9 flex items-center justify-center text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface dark:hover:text-dark-on-surface rounded-full"
                    >
                      <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                    </button>
                  </div>
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(true)}
                    className="font-label text-xs font-semibold text-light-primary-container dark:text-dark-primary hover:underline py-1"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[48px] px-6 py-3 mt-1 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center disabled:opacity-60"
              >
                {busy ? 'Connexion...' : 'Se connecter'}
              </button>

              {supabaseEnabled && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGoogleLogin()}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-md border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-lowest dark:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface font-headline font-semibold text-sm hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
                >
                  <MaterialIcon name="account_circle" className="text-[20px]" />
                  <span>Continuer avec Google</span>
                </button>
              )}
            </form>
          </main>

          <footer className="text-center pt-6">
            <p className="font-body text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Nouveau sur PNC Alerte ?{' '}
              <button
                type="button"
                onClick={onGoToRegister}
                className="font-semibold text-light-primary-container dark:text-dark-primary hover:underline"
              >
                Créer un compte
              </button>
            </p>
          </footer>
        </div>
      </div>

      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold text-light-on-surface dark:text-dark-on-surface">
                Assistance compte citoyen
              </h2>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setForgotModalOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container"
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant leading-relaxed">
              Pour réinitialiser votre accès, veuillez contacter le commissariat PNC de votre commune avec votre numéro de téléphone enregistré, ou appeler la ligne d&apos;assistance nationale au{' '}
              <span className="font-mono font-semibold text-light-on-surface dark:text-dark-on-surface">112</span>.
            </p>
            {supabaseEnabled && (
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Votre adresse e-mail"
                  className="w-full min-h-11 px-3 py-2 rounded-md border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container text-sm"
                />
                {resetNotice && (
                  <p className="text-xs text-light-primary-container dark:text-dark-primary font-medium">
                    {resetNotice}
                  </p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    const sb = getSupabaseClientSync();
                    if (!sb || !resetEmail.trim()) return;
                    const { error: resetErr } = await sb.auth.resetPasswordForEmail(
                      resetEmail.trim(),
                      { redirectTo: window.location.origin }
                    );
                    setResetNotice(
                      resetErr
                        ? resetErr.message
                        : 'Lien de réinitialisation envoyé par e-mail.'
                    );
                  }}
                  className="w-full min-h-[42px] px-4 py-2 rounded-md border border-light-primary text-light-primary-container dark:text-dark-primary font-headline font-semibold text-sm"
                >
                  Envoyer le lien par e-mail
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setForgotModalOpen(false)}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-sm hover:bg-light-primary transition-colors"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface RegisterScreenProps {
  supabaseEnabled?: boolean;
  onAuthenticated: (token: string, user: UserProfile) => void;
  onGoToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  supabaseEnabled = false,
  onAuthenticated,
  onGoToLogin,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [commune, setCommune] = useState(KINSHASA_COMMUNES[8]); // Kintambo, Kinshasa
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2 || phone.replace(/\D/g, '').length < 8 || password.length < 6) {
      setError(
        'Veuillez renseigner votre nom complet, un téléphone valide (8 chiffres min.) et un mot de passe (6 car. min.).'
      );
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const res = await pncApi.registerCitizen({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        commune,
        password,
      });
      if (res.requiresEmailConfirmation || !res.token) {
        setNotice(
          res.message ||
            'Compte créé. Vérifiez votre boîte e-mail pour confirmer votre compte avant de vous connecter.'
        );
        return;
      }
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-light-surface dark:bg-dark-background flex items-center justify-center lg:p-8">
      <div className="min-h-screen lg:min-h-[680px] w-full max-w-[430px] lg:max-w-4xl mx-auto bg-light-surface-container-lowest dark:bg-dark-surface-container-lowest lg:rounded-2xl lg:border lg:border-light-outline-variant dark:lg:border-dark-outline-variant overflow-hidden grid grid-cols-1 lg:grid-cols-2">
        <aside className="hidden lg:flex flex-col justify-between bg-brand-navy text-on-brand-navy p-10">
          <div className="flex items-center gap-3">
            <img
              src={ASSETS.pncCrest}
              alt="Emblème PNC"
              referrerPolicy="no-referrer"
              className="w-12 h-12 object-contain shrink-0"
            />
            <div>
              <p className="font-headline text-lg font-bold">PNC Alerte</p>
              <p className="text-xs text-light-inverse-primary">Inscription citoyenne</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-2xl font-bold text-balance">
              Rejoignez le réseau de vigilance citoyenne
            </h2>
            <p className="text-sm text-light-inverse-primary leading-relaxed">
              Votre compte vous permet de déposer des plaintes en ligne, suivre l’avancement de vos signalements auprès du Centre de Commandement et recevoir les alertes officielles.
            </p>
          </div>
          <p className="text-xs text-light-inverse-primary/80">
            Données chiffrées et protégées conformément à la loi en RDC
          </p>
        </aside>

        <div className="flex flex-col justify-between px-4 sm:px-8 py-6">
          <main className="flex flex-col gap-4">
            <header className="flex items-center gap-3 pt-2">
              <button
                type="button"
                aria-label="Retour"
                onClick={onGoToLogin}
                className="w-10 h-10 rounded-full flex items-center justify-center text-light-on-surface dark:text-dark-on-surface hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container-low"
              >
                <MaterialIcon name="arrow_back_ios_new" className="text-[20px]" />
              </button>
              <div>
                <h1 className="font-headline text-xl font-bold text-light-on-surface dark:text-dark-on-surface">
                  Créer un compte
                </h1>
                <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant">
                  Renseignez vos informations personnelles
                </p>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
              {error && (
                <div className="p-3 rounded-md bg-sos-container text-on-sos-container text-xs font-medium flex items-center gap-2">
                  <MaterialIcon name="error" className="text-[18px] shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {notice && (
                <div className="p-3 rounded-md bg-light-secondary-container text-light-on-secondary-container text-xs font-medium flex items-center gap-2">
                  <MaterialIcon name="mark_email_read" className="text-[18px] shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Nom complet
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Prénom et nom"
                  className="w-full min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Numéro de téléphone
                </span>
                <div className="flex items-center rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant focus-within:border-light-primary focus-within:ring-1 focus-within:ring-light-primary overflow-hidden">
                  <span className="font-mono text-[13px] font-semibold text-light-on-surface-variant dark:text-dark-on-surface-variant px-3 py-3 border-r border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-low dark:bg-dark-surface-container tabular-nums">
                    +243
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="81 000 0000"
                    className="w-full min-h-12 px-3 py-2.5 border-0 bg-transparent text-sm text-light-on-surface dark:text-dark-on-surface tabular-nums focus:outline-none focus:ring-0"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Commune de résidence
                </span>
                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                >
                  {KINSHASA_COMMUNES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Email (facultatif)
                </span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.cd"
                  className="w-full min-h-12 px-3.5 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface placeholder:text-light-on-surface-variant focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-label text-xs font-semibold text-light-on-surface dark:text-dark-on-surface">
                  Mot de passe (6 caractères minimum)
                </span>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Choisissez un mot de passe"
                    className="w-full min-h-12 px-3.5 pr-11 py-2.5 rounded-md bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant text-sm text-light-on-surface dark:text-dark-on-surface focus:border-light-primary focus:outline-none focus:ring-1 focus:ring-light-primary"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 w-9 h-9 flex items-center justify-center text-light-on-surface-variant dark:text-dark-on-surface-variant hover:text-light-on-surface rounded-full"
                  >
                    <MaterialIcon name={showPassword ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                  </button>
                </div>
              </label>

              <p className="font-body text-xs text-light-on-surface-variant dark:text-dark-on-surface-variant text-center px-2 pt-1">
                En créant un compte, vous acceptez nos{' '}
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="text-light-primary-container dark:text-dark-primary font-medium hover:underline"
                >
                  Conditions d&apos;utilisation
                </button>{' '}
                et{' '}
                <button
                  type="button"
                  onClick={() => setTermsOpen(true)}
                  className="text-light-primary-container dark:text-dark-primary font-medium hover:underline"
                >
                  Politique de confidentialité
                </button>
                .
              </p>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[48px] px-6 py-3 mt-1 rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-[15px] hover:bg-light-primary transition-colors flex items-center justify-center disabled:opacity-60"
              >
                {busy ? 'Création en cours...' : "S'inscrire"}
              </button>

              {supabaseEnabled && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    const sb = getSupabaseClientSync();
                    if (!sb) return;
                    setBusy(true);
                    const { error: oauthErr } = await sb.auth.signInWithOAuth({
                      provider: 'google',
                      options: { redirectTo: window.location.origin },
                    });
                    if (oauthErr) {
                      setError(oauthErr.message);
                      setBusy(false);
                    }
                  }}
                  className="w-full min-h-[46px] px-5 py-2.5 rounded-md border border-light-outline-variant dark:border-dark-outline-variant bg-light-surface-container-lowest dark:bg-dark-surface-container-low text-light-on-surface dark:text-dark-on-surface font-headline font-semibold text-sm hover:bg-light-surface-container-low dark:hover:bg-dark-surface-container transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
                >
                  <MaterialIcon name="account_circle" className="text-[20px]" />
                  <span>Continuer avec Google</span>
                </button>
              )}
            </form>
          </main>

          <footer className="text-center pt-4 pb-2">
            <p className="font-body text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              Déjà un compte ?{' '}
              <button
                type="button"
                onClick={onGoToLogin}
                className="font-semibold text-light-primary-container dark:text-dark-primary hover:underline"
              >
                Se connecter
              </button>
            </p>
          </footer>
        </div>
      </div>

      {termsOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-light-surface-container-lowest dark:bg-dark-surface-container-low border border-light-outline-variant dark:border-dark-outline-variant p-5 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-lg font-bold">Confidentialité &amp; Conditions</h2>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setTermsOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-light-surface-container-low"
              >
                <MaterialIcon name="close" />
              </button>
            </div>
            <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant leading-relaxed">
              Les informations transmises via PNC Alerte sont exclusivement traitées par les services habilités de la Police Nationale Congolaise afin d’assurer votre sécurité et le traitement de vos signalements ou plaintes. Vous pouvez à tout moment activer l’envoi anonyme.
            </p>
            <button
              type="button"
              onClick={() => setTermsOpen(false)}
              className="w-full min-h-[44px] rounded-md bg-light-primary-container text-light-on-primary-container font-headline font-semibold text-sm"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
