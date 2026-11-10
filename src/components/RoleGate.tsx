import { ChevronRight, LogOut, Shield, Stethoscope, Truck, User as UserIcon, Warehouse, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Role, User } from '../domain/types';
import { signOut } from '../lib/serverAuth';
import { pharma, usePharma } from '../store';
import { SERVER_MODE } from '../store/server';
import { useEmbedded } from './layout';
import { ServerLogin } from './ServerLogin';
import { Card } from './ui';

const ROLE_ICON: Record<Role, LucideIcon> = { customer: UserIcon, chemist: Stethoscope, rider: Truck, admin: Shield, dealer: Warehouse };

/**
 * Shows 1-tap demo logins until someone is signed in for this role (a password form in server mode),
 * then renders the role's screen with the signed-in user.
 */
export function RoleGate({ role, children }: { role: Role; children: (user: User) => ReactNode }) {
  const { t } = useTranslation();
  const embedded = useEmbedded();
  const ready = usePharma((s) => s.ready);
  const users = usePharma((s) => s.app.users);
  const stores = usePharma((s) => s.app.stores);
  const dealers = usePharma((s) => s.app.dealers);
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
              <div className="-mr-2 max-h-[52vh] space-y-2 overflow-y-auto pr-2">
                {choices.map((u) => {
                  // Where this person belongs: their store, their dealership or their address.
                  const where = (u.storeId && stores[u.storeId]?.name) || (u.dealerId && dealers[u.dealerId]?.name) || u.address || u.phone;
                  return (
                    <button
                      key={u.id}
                      aria-label={t('gate.continueAs', { name: u.name })}
                      onClick={() => pharma.getState().login(role, u.id)}
                      className="group flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left ring-1 ring-inset ring-slate-200 hover:bg-medical-tint/50 hover:ring-medical-ring"
                    >
                      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-medical-tint text-[13px] font-semibold text-medical-dark">
                        {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">{u.name}</span>
                        {where && <span className="block truncate text-xs text-slate-500">{where}</span>}
                      </span>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-medical" />
                    </button>
                  );
                })}
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
