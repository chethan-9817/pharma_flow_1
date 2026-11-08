import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { User } from '../domain/types';
import { fetchHealth, signIn } from '../lib/serverAuth';
import { DEMO_PASSWORD } from '../store/server';
import { Button } from './ui';

const field =
  'mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-medical focus:ring-4 focus:ring-medical/15';

/** The sign-in form for server mode: a real password, checked by the server. */
export function ServerLogin({ choices, dark, onSignedIn }: { choices: User[]; dark?: boolean; onSignedIn: (userId: string) => void }) {
  const { t } = useTranslation();
  const [userId, setUserId] = useState(choices[0]?.id ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  // The hint is shown only while the server still has the built-in demo password.
  useEffect(() => {
    let live = true;
    void fetchHealth().then((health) => live && setShowHint(Boolean(health?.demoPassword)));
    return () => {
      live = false;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn(userId, password);
    setBusy(false);
    if (result.ok) onSignedIn(userId);
    else setError(result.error);
  };

  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4">
      <label className={`block text-xs font-medium ${muted}`}>
        {t('gate.user')}
        <select className={field} value={userId} onChange={(e) => setUserId(e.target.value)} aria-label={t('gate.user')}>
          {choices.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`block text-xs font-medium ${muted}`}>
        {t('gate.password')}
        <input
          className={field}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-label={t('gate.password')}
          required
        />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      <Button type="submit" block size="lg" variant={dark ? 'dark' : 'primary'} disabled={busy || !password}>
        {busy ? t('gate.signingIn') : t('gate.signIn')}
      </Button>
      {showHint && <p className={`text-center text-xs ${muted}`}>{t('gate.demoPasswordHint', { password: DEMO_PASSWORD })}</p>}
      <p className={`text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{t('gate.serverNote')}</p>
    </form>
  );
}
