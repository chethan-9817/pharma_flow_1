import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Role, User } from '../domain/types';
import { pharma, usePharma } from '../store';
import { Button, Card } from './ui';

const ROLE_COPY: Record<Role, string> = {
  customer: 'Buy medicines, grab Eco-Sale deals, donate leftovers and dispose of expired strips safely.',
  chemist: 'Your free ERP: scan stock, watch expiry buckets and rescue near-expiry medicines.',
  rider: 'Deliver orders and collect donations and Yellow-Bag pickups.',
  admin: 'Approve pharmacies, track impact and verify the audit ledger.',
};

/**
 * Shows 1-tap demo logins until someone is signed in for this role,
 * then renders the role's screen with the signed-in user.
 */
export function RoleGate({ role, children, dark }: { role: Role; children: (user: User) => ReactNode; dark?: boolean }) {
  const ready = usePharma((s) => s.ready);
  const users = usePharma((s) => s.app.users);
  const userId = usePharma((s) => s.sessions[role]);
  const user = userId ? users[userId] : undefined;

  if (!ready) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-slate-500">Loading PharmaFlow…</div>;
  }

  if (!user) {
    const choices = Object.values(users).filter((u) => u.role === role);
    return (
      <div className="grid min-h-[60vh] place-items-center p-4">
        <Card className={`w-full max-w-sm animate-fade-up space-y-4 p-6 ${dark ? 'bg-slate-900 text-white ring-slate-800' : ''}`}>
          <div>
            <h1 className="text-xl font-bold capitalize">{role} demo login</h1>
            <p className={`mt-1 text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{ROLE_COPY[role]}</p>
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
                Continue as {u.name}
              </Button>
            ))}
          </div>
          <p className={`text-center text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>No sign-up needed. This is a demo.</p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {children(user)}
      <button
        onClick={() => pharma.getState().logout(role)}
        className={`fixed bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium shadow-md ring-1 ${
          dark ? 'bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
        }`}
      >
        <LogOut className="size-3.5" />
        {user.name}
      </button>
    </>
  );
}
