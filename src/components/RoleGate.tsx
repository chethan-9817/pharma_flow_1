import { LogOut, Shield, Stethoscope, Truck, User as UserIcon, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Role, User } from '../domain/types';
import { signOut } from '../lib/serverAuth';
import { pharma, usePharma } from '../store';
import { SERVER_MODE } from '../store/server';
import { useEmbedded } from './layout';
import { ServerLogin } from './ServerLogin';
import { Button, Card } from './ui';

const ROLE_ICON: Record<Role, LucideIcon> = { customer: UserIcon, chemist: Stethoscope, rider: Truck, admin: Shield };

/**
 * Shows 1-tap demo logins until someone is signed in for this role (a password form in server mode),
 * then renders the role's screen with the signed-in user.
 */
export function RoleGate({ role, children }: { role: Role; children: (user: User) => ReactNode }) {
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
    const Icon = ROLE_ICON[role];
    return (
      <div className="grid min-h-[60vh] place-items-center p-4">
        <Card className="w-full max-w-sm animate-fade-up space-y-5 p-6">
          <div className="space-y-3">
            <span className="grid size-11 place-items-center rounded-xl bg-medical-tint text-medical ring-1 ring-inset ring-medical-ring/70">
              <Icon className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t(SERVER_MODE ? 'gate.serverTitle' : 'gate.title', { role: t(`nav.${role}`) })}</h1>
              <p className="mt-1 text-sm text-slate-500">{t(`gate.${role}`)}</p>
            </div>
          </div>
          {SERVER_MODE ? (
            <ServerLogin choices={choices} onSignedIn={(id) => pharma.getState().login(role, id)} />
          ) : (
            <>
              <div className="space-y-2">
                {choices.map((u) => (
                  <Button
                    key={u.id}
                    block
                    size="lg"
                    variant={choices.length > 1 ? 'soft' : 'primary'}
                    onClick={() => pharma.getState().login(role, u.id)}
                  >
                    {t('gate.continueAs', { name: u.name })}
                  </Button>
                ))}
              </div>
              <p className="text-center text-xs text-slate-400">{t('gate.noSignup')}</p>
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <>
      {children(user)}
      <button
        onClick={() => {
          pharma.getState().logout(role);
          if (SERVER_MODE) signOut(user.id);
        }}
        // In the compact panes the pill sits above the phone-style tab bar so it never covers a tab.
        className={`fixed ${embedded ? 'bottom-20 right-3' : 'bottom-4 right-4'} z-30 flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-pop ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900`}
      >
        <LogOut className="size-3.5" />
        {user.name}
      </button>
    </>
  );
}
