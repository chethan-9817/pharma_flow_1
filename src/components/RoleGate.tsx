import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Role, User } from '../domain/types';
import { pharma, usePharma } from '../store';
import { useEmbedded } from './layout';
import { Button, Card } from './ui';

/**
 * Shows 1-tap demo logins until someone is signed in for this role,
 * then renders the role's screen with the signed-in user.
 */
export function RoleGate({ role, children, dark }: { role: Role; children: (user: User) => ReactNode; dark?: boolean }) {
  const { t } = useTranslation();
  const embedded = useEmbedded();
  const ready = usePharma((s) => s.ready);
  const users = usePharma((s) => s.app.users);
  const userId = usePharma((s) => s.sessions[role]);
  const user = userId ? users[userId] : undefined;

  if (!ready) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">{t('common.loading')}</div>;
  }

  if (!user) {
    const choices = Object.values(users).filter((u) => u.role === role);
    return (
      <div className="grid min-h-[60vh] place-items-center p-4">
        <Card className={`w-full max-w-sm animate-fade-up space-y-4 p-6 ${dark ? 'bg-slate-900 text-white ring-slate-800' : ''}`}>
          <div>
            <h1 className="text-xl font-bold">{t('gate.title', { role: t(`nav.${role}`) })}</h1>
            <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{t(`gate.${role}`)}</p>
          </div>
          <div className="space-y-2">
            {choices.map((u) => (
              <Button
                key={u.id}
                block
                size="lg"
                variant={dark ? 'dark' : 'primary'}
                onClick={() => pharma.getState().login(role, u.id)}
              >
                {t('gate.continueAs', { name: u.name })}
              </Button>
            ))}
          </div>
          <p className={`text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{t('gate.noSignup')}</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {children(user)}
      <button
        onClick={() => pharma.getState().logout(role)}
        // In the compact panes the pill sits above the phone-style tab bar so it never covers a tab.
        className={`fixed ${embedded ? 'bottom-20 right-3' : 'bottom-4 right-4'} z-30 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium shadow-md ring-1 ${
          dark ? 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
        }`}
      >
        <LogOut className="size-3.5" />
        {user.name}
      </button>
    </>
  );
}
