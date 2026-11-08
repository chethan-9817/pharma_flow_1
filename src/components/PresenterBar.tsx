import { CalendarClock, ChevronsRight, RotateCcw, Stethoscope, Truck, Shield, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { addDays, daysBetween } from '../domain/clock';
import { DEMO_START } from '../seed';
import { dispatch, pharma, usePharma } from '../store';
import { report, toast } from './toast';

export const PRESENTER_ID = 'u-admin';
const MAX_OFFSET = 730;

const ROLES = [
  { to: '/customer', label: 'Customer', icon: User },
  { to: '/chemist', label: 'Chemist', icon: Stethoscope },
  { to: '/rider', label: 'Rider', icon: Truck },
  { to: '/admin', label: 'Admin', icon: Shield },
];

const JUMPS = [
  { label: '+1 week', days: 7 },
  { label: '+1 month', days: 30 },
  { label: '+5 months', days: 150 },
];

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function PresenterBar() {
  const today = usePharma((s) => s.app.today);
  const offset = daysBetween(DEMO_START, today);
  const [draft, setDraft] = useState(offset);
  useEffect(() => setDraft(offset), [offset]);

  const travel = async (offsetDays: number) => {
    if (offsetDays <= offset) return;
    report(await dispatch(PRESENTER_ID, { type: 'TIME_TRAVELLED', to: addDays(DEMO_START, offsetDays) }));
  };

  const reset = async () => {
    if (!window.confirm('Reset all demo data in every open tab?')) return;
    await pharma.getState().reset();
    toast('Demo data reset');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-medical text-sm font-bold text-white">Rx</span>
          <span className="text-base font-bold tracking-tight text-slate-900">PharmaFlow</span>
        </div>

        <nav className="flex gap-1 rounded-xl bg-slate-100 p-1" aria-label="Switch role">
          {ROLES.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`
              }
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/presenter"
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`
            }
          >
            All 4
          </NavLink>
        </nav>

        <div className="flex min-w-[280px] flex-1 items-center gap-3">
          <CalendarClock className="size-4 shrink-0 text-expiry" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-slate-900">{fmt(today)}</span>
            <span className="text-[11px] text-slate-500">{offset === 0 ? 'Start of demo' : `Day +${offset}`}</span>
          </div>
          <input
            type="range"
            min={offset}
            max={MAX_OFFSET}
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value))}
            onPointerUp={() => void travel(draft)}
            onKeyUp={() => void travel(draft)}
            aria-label="Time travel"
            className="h-1.5 min-w-24 flex-1 cursor-pointer accent-medical"
          />
          <div className="hidden gap-1 lg:flex">
            {JUMPS.map((j) => (
              <button
                key={j.label}
                onClick={() => void travel(offset + j.days)}
                className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                <ChevronsRight className="size-3" />
                {j.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => void reset()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <RotateCcw className="size-4" />
          <span className="hidden md:inline">Reset demo</span>
        </button>
      </div>
    </header>
  );
}
